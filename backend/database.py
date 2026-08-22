"""MongoDB persistence and ephemeral matchmaking state for Fire Feast."""

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional

from pymongo import ASCENDING, MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import BackendConfig


mongo_client: Optional[MongoClient] = None
player_collection: Optional[Collection] = None
settings_collection: Optional[Collection] = None
social_relationship_collection: Optional[Collection] = None
pvp_challenge_collection: Optional[Collection] = None
pvp_match_collection: Optional[Collection] = None

DATABASE_READINESS_TIMEOUT_MS = 3_000


@dataclass(frozen=True)
class DatabaseReadiness:
    ready: bool
    category: Literal["ready", "uninitialized", "timeout", "driver_error"]
    exception_type: Optional[str] = None


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
    result.pop("bootstrap_recovery_nonce_hash", None)
    result.pop("bootstrap_recovery_expires_at", None)
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


def social_relationships() -> Collection:
    if social_relationship_collection is None:
        raise RuntimeError("database is not initialized")
    return social_relationship_collection


def pvp_challenges() -> Collection:
    if pvp_challenge_collection is None:
        raise RuntimeError("database is not initialized")
    return pvp_challenge_collection


def pvp_matches() -> Collection:
    if pvp_match_collection is None:
        raise RuntimeError("database is not initialized")
    return pvp_match_collection


def initialize_database(config: BackendConfig) -> None:
    """Verify MongoDB and create the indexes/default documents we rely on."""
    global mongo_client, player_collection, settings_collection, social_relationship_collection, pvp_challenge_collection, pvp_match_collection
    close_database()
    client = MongoClient(
        config.mongo_url,
        serverSelectionTimeoutMS=DATABASE_READINESS_TIMEOUT_MS,
    )
    try:
        client.admin.command("ping")
        database = client[config.db_name]
        players = database["players"]
        settings = database["settings"]
        relationships = database["social_relationships"]
        challenges = database["pvp_challenges"]
        matches = database["pvp_matches"]
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
        players.create_index(
            [("public_id", ASCENDING)], unique=True, sparse=True, name="player_public_id_unique"
        )
        players.create_index(
            [("public_handle_normalized", ASCENDING)],
            unique=True,
            sparse=True,
            name="player_public_handle_unique",
        )
        players.create_index(
            [("contest_best_scores.contest_id", ASCENDING)],
            name="player_contest_best_lookup",
        )
        relationships.create_index(
            [("pair_key", ASCENDING)], unique=True, name="social_pair_unique"
        )
        relationships.create_index(
            [("requester_public_id", ASCENDING), ("status", ASCENDING)],
            name="social_requester_status",
        )
        relationships.create_index(
            [("recipient_public_id", ASCENDING), ("status", ASCENDING)],
            name="social_recipient_status",
        )
        challenges.create_index([("challenge_id", ASCENDING)], unique=True, name="pvp_challenge_id_unique")
        challenges.create_index(
            [("pair_contest_key", ASCENDING)], unique=True,
            partialFilterExpression={"status": "PENDING"}, name="pvp_pending_pair_contest_unique",
        )
        challenges.create_index([("recipient_public_id", ASCENDING), ("status", ASCENDING)], name="pvp_challenge_incoming")
        challenges.create_index([("challenger_public_id", ASCENDING), ("status", ASCENDING)], name="pvp_challenge_outgoing")
        challenges.create_index([("expires_at", ASCENDING)], name="pvp_challenge_expiry")
        challenges.create_index([("rematch_of", ASCENDING), ("status", ASCENDING)], name="pvp_rematch_status")
        matches.create_index([("match_id", ASCENDING)], unique=True, name="pvp_match_id_unique")
        matches.create_index([("challenge_id", ASCENDING)], unique=True, name="pvp_match_challenge_unique")
        matches.create_index([("participant_public_ids", ASCENDING), ("status", ASCENDING)], name="pvp_participant_status")
        matches.create_index([("participant_public_ids", ASCENDING), ("status", ASCENDING), ("finalized_at", -1)], name="pvp_recent_opponents")
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
    social_relationship_collection = relationships
    pvp_challenge_collection = challenges
    pvp_match_collection = matches


def close_database() -> None:
    """Release MongoDB and ephemeral process state during graceful shutdown."""
    global mongo_client, player_collection, settings_collection, social_relationship_collection, pvp_challenge_collection, pvp_match_collection
    client = mongo_client
    mongo_client = None
    player_collection = None
    settings_collection = None
    social_relationship_collection = None
    pvp_challenge_collection = None
    pvp_match_collection = None
    queue.clear()
    active_matches.clear()
    if client is not None:
        client.close()


def database_connected() -> bool:
    """Compatibility wrapper for callers that only need a boolean."""
    return database_readiness().ready


def database_readiness() -> DatabaseReadiness:
    """Run a bounded, read-only ping against the shared MongoDB client."""
    client = mongo_client
    if client is None:
        return DatabaseReadiness(False, "uninitialized")
    try:
        client.admin.command("ping", maxTimeMS=DATABASE_READINESS_TIMEOUT_MS)
        return DatabaseReadiness(True, "ready")
    except TimeoutError as error:
        return DatabaseReadiness(False, "timeout", type(error).__name__)
    except PyMongoError as error:
        category = "timeout" if getattr(error, "timeout", False) else "driver_error"
        return DatabaseReadiness(False, category, type(error).__name__)
    except Exception as error:
        return DatabaseReadiness(False, "driver_error", type(error).__name__)


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


def find_internal_player_by_installation_hash(
    installation_id_hash: str,
) -> Optional[dict]:
    return _players().find_one({"installation_id_hash": installation_id_hash})


def recover_guest_credentials(
    installation_id_hash: str,
    recovery_nonce_hash: str,
    current_time: str,
    new_auth_token_hash: str,
    token_created_at: str,
) -> Optional[dict]:
    """Atomically consume one live recovery nonce and rotate the bearer hash."""
    return _players().find_one_and_update(
        {
            "installation_id_hash": installation_id_hash,
            "bootstrap_recovery_nonce_hash": recovery_nonce_hash,
            "bootstrap_recovery_expires_at": {"$gt": current_time},
        },
        {
            "$set": {
                "auth_token_hash": new_auth_token_hash,
                "token_created_at": token_created_at,
            },
            "$inc": {"token_version": 1},
            "$unset": {
                "bootstrap_recovery_nonce_hash": "",
                "bootstrap_recovery_expires_at": "",
            },
        },
        return_document=ReturnDocument.AFTER,
    )


def complete_guest_bootstrap(
    device_id: str,
    auth_token_hash: str,
) -> Optional[dict]:
    """Remove unused bootstrap recovery state after credentials are durable."""
    return _players().find_one_and_update(
        {"device_id": device_id, "auth_token_hash": auth_token_hash},
        {
            "$unset": {
                "bootstrap_recovery_nonce_hash": "",
                "bootstrap_recovery_expires_at": "",
            }
        },
        return_document=ReturnDocument.AFTER,
    )


def find_player_document(device_id: str) -> Optional[dict]:
    return _public_document(_players().find_one({"device_id": device_id}))


def find_internal_player(device_id: str) -> Optional[dict]:
    return _players().find_one({"device_id": device_id})


def find_internal_player_by_auth_hash(auth_token_hash: str) -> Optional[dict]:
    return _players().find_one({"auth_token_hash": auth_token_hash})


def find_internal_player_by_public_id(public_id: str) -> Optional[dict]:
    return _players().find_one({"public_id": public_id})


def find_internal_player_by_handle(normalized_handle: str) -> Optional[dict]:
    return _players().find_one({"public_handle_normalized": normalized_handle})


def assign_public_identity(device_id: str, public_id: str, handle: str) -> Optional[dict]:
    return _players().find_one_and_update(
        {"device_id": device_id, "public_id": {"$exists": False}},
        {"$set": {"public_id": public_id, "public_handle": handle, "public_handle_normalized": handle}},
        return_document=ReturnDocument.AFTER,
    )


def update_public_identity(device_id: str, values: dict) -> Optional[dict]:
    return _players().find_one_and_update(
        {"device_id": device_id},
        {"$set": values},
        return_document=ReturnDocument.AFTER,
    )


def search_public_players(prefix: str, exclude_public_id: str, limit: int) -> list:
    import re

    cursor = _players().find(
        {
            "public_handle_normalized": {"$regex": f"^{re.escape(prefix)}"},
            "public_id": {"$ne": exclude_public_id},
        },
        {"_id": 0},
    ).sort("public_handle_normalized", ASCENDING).limit(limit)
    return list(cursor)


def public_players_by_ids(public_ids: list[str]) -> list:
    if not public_ids:
        return []
    return list(_players().find({"public_id": {"$in": public_ids}}, {"_id": 0}))


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

    internal = _players().find_one({"device_id": player_id, "auth_token_hash": auth_token_hash})
    public_id = internal.get("public_id") if internal else None
    if public_id:
        social_relationships().delete_many(
            {"$or": [{"requester_public_id": public_id}, {"recipient_public_id": public_id}]}
        )
        if pvp_challenge_collection is not None:
            pvp_challenges().delete_many(
                {"$or": [{"challenger_public_id": public_id}, {"recipient_public_id": public_id}]}
            )
        if pvp_match_collection is not None:
            pvp_matches().delete_many({"participant_public_ids": public_id})
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
    rejection_reason: Optional[str] = None,
) -> Optional[dict]:
    """Atomically close one unresolved match without applying rewards."""
    query = {"device_id": device_id}
    if match_id:
        query["active_match.id"] = match_id
    else:
        query["active_match"] = {"$exists": True}
    lifecycle = {
        "match_id": match_id or "malformed",
        "status": status,
        "ended_at": ended_at,
    }
    if rejection_reason:
        lifecycle["rejection_reason"] = rejection_reason
    return _players().find_one_and_update(
        query,
        {
            "$set": {"last_match_lifecycle": lifecycle},
            "$unset": {"active_match": ""},
        },
        return_document=ReturnDocument.AFTER,
    )


def _leaderboard_projection() -> dict:
    return {"_id": 0, "public_id": 1, "public_handle": 1, "public_display_name": 1, "public_avatar": 1, "username": 1, "best_score": 1, "xp": 1, "level": 1}


def leaderboard_players(limit: int = 200) -> list:
    cursor = _players().find(
        {"best_score": {"$gt": 0}, "public_id": {"$exists": True}},
        _leaderboard_projection(),
    ).sort([("best_score", -1), ("xp", -1), ("public_id", 1)]).limit(limit)
    return list(cursor)


def contest_leaderboard_players(contest_id: str, limit: int = 100) -> list:
    pipeline = [
        {"$match": {"contest_best_scores.contest_id": contest_id, "public_id": {"$exists": True}}},
        {"$unwind": "$contest_best_scores"},
        {"$match": {"contest_best_scores.contest_id": contest_id, "contest_best_scores.score": {"$gt": 0}, "public_id": {"$exists": True}}},
        {"$sort": {"contest_best_scores.score": -1, "contest_best_scores.achieved_at": 1, "public_id": 1}},
        {"$limit": max(1, min(int(limit), 100))},
        {"$project": _leaderboard_projection() | {"contest_score": "$contest_best_scores.score", "achieved_at": "$contest_best_scores.achieved_at"}},
    ]
    return list(_players().aggregate(pipeline))


def contest_player_rank(contest_id: str, public_id: str) -> Optional[dict]:
    own_rows = list(_players().aggregate([
        {"$match": {"public_id": public_id}}, {"$unwind": "$contest_best_scores"},
        {"$match": {"contest_best_scores.contest_id": contest_id}},
        {"$project": _leaderboard_projection() | {"contest_score": "$contest_best_scores.score", "achieved_at": "$contest_best_scores.achieved_at"}},
        {"$limit": 1},
    ]))
    if not own_rows:
        return None
    own = own_rows[0]
    score, achieved = int(own["contest_score"]), own["achieved_at"]
    ahead = list(_players().aggregate([
        {"$match": {"contest_best_scores.contest_id": contest_id, "public_id": {"$exists": True}}},
        {"$unwind": "$contest_best_scores"},
        {"$match": {"contest_best_scores.contest_id": contest_id, "public_id": {"$exists": True}, "$or": [
            {"contest_best_scores.score": {"$gt": score}},
            {"contest_best_scores.score": score, "contest_best_scores.achieved_at": {"$lt": achieved}},
            {"contest_best_scores.score": score, "contest_best_scores.achieved_at": achieved, "public_id": {"$lt": public_id}},
        ]}},
        {"$count": "count"},
    ]))
    own["position"] = int(ahead[0]["count"] if ahead else 0) + 1
    return own

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
