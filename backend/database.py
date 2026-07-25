"""MongoDB persistence and ephemeral matchmaking state for Fire Feast."""

from typing import Dict, List, Optional

from pymongo import ASCENDING, MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import BackendConfig


mongo_client: Optional[MongoClient] = None
player_collection: Optional[Collection] = None
settings_collection: Optional[Collection] = None


DEFAULT_SETTINGS = {
    "version": "3.0",
    "maintenance": False,
    "featured_contest": None,
}


def _public_document(document: Optional[dict]) -> Optional[dict]:
    if document is None:
        return None
    result = dict(document)
    result.pop("_id", None)
    result.pop("active_match", None)
    result.pop("last_match_result", None)
    result.pop("auth_token_hash", None)
    result.pop("installation_id_hash", None)
    result.pop("token_created_at", None)
    result.pop("token_version", None)
    result.pop("legacy_auth_migrated_at", None)
    return result


def public_player_document(document: Optional[dict]) -> Optional[dict]:
    return _public_document(document)


def _players() -> Collection:
    if player_collection is None:
        raise RuntimeError("database is not initialized")
    return player_collection


def _settings() -> Collection:
    if settings_collection is None:
        raise RuntimeError("database is not initialized")
    return settings_collection


def initialize_database(config: BackendConfig) -> None:
    """Verify MongoDB and create the indexes/default documents we rely on."""
    global mongo_client, player_collection, settings_collection
    close_database()
    client = MongoClient(config.mongo_url, serverSelectionTimeoutMS=3000)
    try:
        client.admin.command("ping")
        database = client[config.db_name]
        players = database["players"]
        settings = database["settings"]
        players.create_index(
            [("device_id", ASCENDING)], unique=True, name="player_device_id_unique"
        )
        players.create_index(
            [("player_id", ASCENDING)],
            unique=True,
            sparse=True,
            name="player_id_unique",
        )
        players.create_index(
            [("installation_id_hash", ASCENDING)],
            unique=True,
            sparse=True,
            name="player_installation_unique",
        )
        players.create_index(
            [("auth_token_hash", ASCENDING)],
            unique=True,
            sparse=True,
            name="player_auth_token_unique",
        )
        settings.update_one(
            {"_id": "global"},
            {"$setOnInsert": DEFAULT_SETTINGS},
            upsert=True,
        )
    except Exception:
        client.close()
        raise
    mongo_client = client
    player_collection = players
    settings_collection = settings


def close_database() -> None:
    """Release MongoDB and ephemeral process state during graceful shutdown."""
    global mongo_client, player_collection, settings_collection
    client = mongo_client
    mongo_client = None
    player_collection = None
    settings_collection = None
    queue.clear()
    active_matches.clear()
    if client is not None:
        client.close()


def database_connected() -> bool:
    client = mongo_client
    if client is None:
        return False
    try:
        client.admin.command("ping")
        return True
    except PyMongoError:
        return False


def create_or_get_player(defaults: dict) -> dict:
    try:
        document = _players().find_one_and_update(
            {"device_id": defaults["device_id"]},
            {"$setOnInsert": defaults},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        # A simultaneous first request may win the unique-device insert.
        document = _players().find_one({"device_id": defaults["device_id"]})
    return _public_document(document) or dict(defaults)


def create_guest_player(document: dict) -> Optional[dict]:
    """Insert one authenticated guest, or return None for a bootstrap replay."""
    try:
        _players().insert_one(document)
    except DuplicateKeyError:
        return None
    return _public_document(document)


def installation_has_guest(installation_id_hash: str) -> bool:
    return (
        _players().count_documents(
            {"installation_id_hash": installation_id_hash},
            limit=1,
        )
        > 0
    )


def find_player_document(device_id: str) -> Optional[dict]:
    return _public_document(_players().find_one({"device_id": device_id}))


def find_internal_player(device_id: str) -> Optional[dict]:
    return _players().find_one({"device_id": device_id})


def find_internal_player_by_auth_hash(auth_token_hash: str) -> Optional[dict]:
    return _players().find_one({"auth_token_hash": auth_token_hash})


def delete_guest_player(player_id: str, auth_token_hash: str) -> None:
    """Delete all current-schema data linked to an authenticated guest.

    Deleted:
    - The player document, including profile, credentials, installation hash,
      progression, inventory, rewards, purchases represented by inventory/
      balances, active match, and last match result.
    - Process-local matchmaking queue and matched-session references.

    Preserved/anonymized:
    - Nothing. Leaderboard rows are live projections of player documents, so
      deletion removes the entry. No separate history/aggregate collections
      currently exist, and no retention requirement is assumed.

    Cleanup is idempotent and the MongoDB document is deleted last. If cleanup
    is interrupted, a retry can safely repeat the ephemeral removals. Once the
    document is gone, stale credentials cannot authenticate and no current
    write path uses upsert to recreate it.
    """
    queue[:] = [entry for entry in queue if entry.get("device_id") != player_id]
    stale_match_ids = [
        match_id
        for match_id, match in active_matches.items()
        if player_id in match.get("players", [])
    ]
    for match_id in stale_match_ids:
        active_matches.pop(match_id, None)

    _players().delete_one(
        {
            "device_id": player_id,
            "auth_token_hash": auth_token_hash,
        }
    )


def update_player_document(
    device_id: str,
    update: dict,
    *,
    extra_filter: Optional[dict] = None,
) -> Optional[dict]:
    query = {"device_id": device_id}
    if extra_filter:
        query.update(extra_filter)
    document = _players().find_one_and_update(
        query,
        update,
        return_document=ReturnDocument.AFTER,
    )
    return _public_document(document)


def player_count() -> int:
    return _players().count_documents({})


def start_player_match(device_id: str, entry_fee: int, match: dict) -> Optional[dict]:
    document = _players().find_one_and_update(
        {
            "device_id": device_id,
            "coins": {"$gte": entry_fee},
            "active_match": {"$exists": False},
        },
        {
            "$inc": {"coins": -entry_fee},
            "$set": {"active_match": match},
        },
        return_document=ReturnDocument.AFTER,
    )
    return document


def settle_player_match(
    device_id: str,
    match_id: str,
    update_pipeline: list,
) -> Optional[dict]:
    return _players().find_one_and_update(
        {"device_id": device_id, "active_match.id": match_id},
        update_pipeline,
        return_document=ReturnDocument.AFTER,
    )


def transition_player_match(
    device_id: str,
    match_id: Optional[str],
    status: str,
    ended_at: str,
) -> Optional[dict]:
    """Atomically close one unresolved match without applying rewards."""
    query = {"device_id": device_id}
    if match_id:
        query["active_match.id"] = match_id
    else:
        query["active_match"] = {"$exists": True}
    return _players().find_one_and_update(
        query,
        {
            "$set": {
                "last_match_lifecycle": {
                    "match_id": match_id or "malformed",
                    "status": status,
                    "ended_at": ended_at,
                }
            },
            "$unset": {"active_match": ""},
        },
        return_document=ReturnDocument.AFTER,
    )


def leaderboard_players(limit: int = 200) -> list:
    cursor = _players().find(
        {"best_score": {"$gt": 0}},
        {"_id": 0, "active_match": 0, "last_match_result": 0},
    ).sort([("best_score", -1), ("xp", -1), ("device_id", 1)]).limit(limit)
    return list(cursor)


def get_settings() -> dict:
    document = _settings().find_one({"_id": "global"})
    if document is None:
        _settings().update_one(
            {"_id": "global"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True
        )
        return dict(DEFAULT_SETTINGS)
    document.pop("_id", None)
    return document


def update_settings(values: dict) -> dict:
    _settings().update_one(
        {"_id": "global"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True
    )
    document = _settings().find_one_and_update(
        {"_id": "global"},
        {"$set": values},
        return_document=ReturnDocument.AFTER,
    )
    document = dict(document or DEFAULT_SETTINGS)
    document.pop("_id", None)
    return document


# Matchmaking is intentionally process-local and short-lived. A server restart
# cancels searches rather than restoring stale queue entries or active matches.
queue: List[dict] = []
active_matches: Dict[str, dict] = {}


# Static catalogs remain in backend/data. These aliases are retained for code
# that imports them from database.py.
contests: List[dict] = []
tournaments: List[dict] = []
daily_rewards: List[dict] = []
shop_items: List[dict] = []
gear_items: List[dict] = []
leaderboard: List[dict] = []
opponents: List[dict] = []


settings = DEFAULT_SETTINGS
