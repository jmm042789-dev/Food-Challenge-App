"""MongoDB persistence and ephemeral matchmaking state for Fire Feast."""

import os
from typing import Dict, List, Optional

from pymongo import ASCENDING, MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, PyMongoError


MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.environ.get("DB_NAME", "fire_feast")

mongo_client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=3000)
database = mongo_client[DB_NAME]
player_collection: Collection = database["players"]
settings_collection: Collection = database["settings"]


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


def initialize_database() -> None:
    """Verify MongoDB and create the indexes/default documents we rely on."""
    mongo_client.admin.command("ping")
    player_collection.create_index(
        [("device_id", ASCENDING)], unique=True, name="player_device_id_unique"
    )
    player_collection.create_index(
        [("player_id", ASCENDING)],
        unique=True,
        sparse=True,
        name="player_id_unique",
    )
    player_collection.create_index(
        [("installation_id_hash", ASCENDING)],
        unique=True,
        sparse=True,
        name="player_installation_unique",
    )
    settings_collection.update_one(
        {"_id": "global"},
        {"$setOnInsert": DEFAULT_SETTINGS},
        upsert=True,
    )


def database_connected() -> bool:
    try:
        mongo_client.admin.command("ping")
        return True
    except PyMongoError:
        return False


def create_or_get_player(defaults: dict) -> dict:
    try:
        document = player_collection.find_one_and_update(
            {"device_id": defaults["device_id"]},
            {"$setOnInsert": defaults},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        # A simultaneous first request may win the unique-device insert.
        document = player_collection.find_one({"device_id": defaults["device_id"]})
    return _public_document(document) or dict(defaults)


def create_guest_player(document: dict) -> Optional[dict]:
    """Insert one authenticated guest, or return None for a bootstrap replay."""
    try:
        player_collection.insert_one(document)
    except DuplicateKeyError:
        return None
    return _public_document(document)


def installation_has_guest(installation_id_hash: str) -> bool:
    return (
        player_collection.count_documents(
            {"installation_id_hash": installation_id_hash},
            limit=1,
        )
        > 0
    )


def find_player_document(device_id: str) -> Optional[dict]:
    return _public_document(player_collection.find_one({"device_id": device_id}))


def find_internal_player(device_id: str) -> Optional[dict]:
    return player_collection.find_one({"device_id": device_id})


def update_player_document(
    device_id: str,
    update: dict,
    *,
    extra_filter: Optional[dict] = None,
) -> Optional[dict]:
    query = {"device_id": device_id}
    if extra_filter:
        query.update(extra_filter)
    document = player_collection.find_one_and_update(
        query,
        update,
        return_document=ReturnDocument.AFTER,
    )
    return _public_document(document)


def player_count() -> int:
    return player_collection.count_documents({})


def start_player_match(device_id: str, entry_fee: int, match: dict) -> Optional[dict]:
    document = player_collection.find_one_and_update(
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
    return player_collection.find_one_and_update(
        {"device_id": device_id, "active_match.id": match_id},
        update_pipeline,
        return_document=ReturnDocument.AFTER,
    )


def leaderboard_players(limit: int = 200) -> list:
    cursor = player_collection.find(
        {"best_score": {"$gt": 0}},
        {"_id": 0, "active_match": 0, "last_match_result": 0},
    ).sort([("best_score", -1), ("xp", -1), ("device_id", 1)]).limit(limit)
    return list(cursor)


def get_settings() -> dict:
    document = settings_collection.find_one({"_id": "global"})
    if document is None:
        settings_collection.update_one(
            {"_id": "global"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True
        )
        return dict(DEFAULT_SETTINGS)
    document.pop("_id", None)
    return document


def update_settings(values: dict) -> dict:
    settings_collection.update_one(
        {"_id": "global"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True
    )
    document = settings_collection.find_one_and_update(
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
