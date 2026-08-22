"""Authenticated public-profile and friend relationship domain."""

from datetime import datetime, timezone
import re
import secrets

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from database import (
    assign_public_identity,
    find_internal_player,
    find_internal_player_by_handle,
    find_internal_player_by_public_id,
    public_players_by_ids,
    search_public_players,
    social_relationships,
    update_public_identity,
)


HANDLE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,19}$")
RESERVED_HANDLES = {"admin", "administrator", "firefeast", "moderator", "support", "system"}
PUBLIC_PROFILE_FIELDS = {
    "public_id", "handle", "display_name", "avatar", "level", "rank", "wins", "matches", "best_score"
}

AVATAR_OPTIONS = {
    "base": {"round", "angular", "soft", "oval", "square"},
    "hair": {"short", "spiked", "curls", "long", "shaved", "mohawk", "fade", "waves", "braids", "ponytail"},
    "eyes": {"bright", "focused", "happy", "bold", "wink", "intense"},
    "facialHair": {"none", "stubble", "mustache", "goatee", "beard", "full_beard"},
    "glasses": {"none", "round", "square", "arcade", "shades", "sport"},
    "headwear": {"none", "cap", "back_cap", "chef", "bandana", "visor", "flame", "crown"},
    "clothing": {"shirt", "hoodie", "jacket", "chefcoat", "classic", "street", "grill", "champion"},
    "apron": {"none", "classic", "waist", "competition", "grill", "trimmed", "tester"},
    "outfitColor": {"inferno", "charcoal", "gold", "cream", "emerald", "royal", "ocean", "berry"},
    "accessory": {"none", "earring", "hoops", "necklace", "scarf", "badge", "medal", "bandage", "wristband"},
    "background": {"inferno", "sunset", "midnight", "emerald", "royal", "steel", "ocean", "champion"},
}
PRESENTATIONS = {"male", "female", "non_binary"}
LEGACY_SKIN = {"porcelain": 5, "warm": 23, "bronze": 45, "deep": 72, "rich": 92}
LEGACY_HAIR = {"midnight": 2, "ember": 18, "gold": 35, "fire": 48, "silver": 57, "plum": 76}
DEFAULT_AVATAR = {
    "base": "angular", "skinTone": "warm", "hair": "spiked", "hairColor": "ember",
    "eyes": "focused", "facialHair": "none", "glasses": "none", "headwear": "none",
    "clothing": "shirt", "apron": "classic", "outfitColor": "inferno", "accessory": "none", "background": "inferno",
}


class SocialError(Exception):
    def __init__(self, code: str, status_code: int = 400):
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def normalize_handle(value: str) -> str:
    return value.strip().lower()


def validate_handle(value: str) -> str:
    normalized = normalize_handle(value)
    if not HANDLE_PATTERN.fullmatch(normalized) or normalized in RESERVED_HANDLES:
        raise SocialError("INVALID_HANDLE")
    return normalized


def sanitize_avatar(value) -> dict:
    source = value if isinstance(value, dict) else {}
    sanitized = {
        key: source.get(key) if source.get(key) in allowed else DEFAULT_AVATAR[key]
        for key, allowed in AVATAR_OPTIONS.items() if key not in {"skinTone", "hairColor"}
    }
    def slider(key, legacy_key, legacy, fallback):
        raw = source.get(key, legacy.get(str(source.get(legacy_key)), fallback))
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            return fallback
        return max(0, min(100, round(raw)))
    sanitized.update({
        "presentation": source.get("presentation") if source.get("presentation") in PRESENTATIONS else "non_binary",
        "skinToneValue": slider("skinToneValue", "skinTone", LEGACY_SKIN, 23),
        "hairColorValue": slider("hairColorValue", "hairColor", LEGACY_HAIR, 18),
    })
    return sanitized


def sanitize_display_name(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not 3 <= len(normalized) <= 20 or not re.fullmatch(r"[A-Za-z0-9_ ]+", normalized):
        raise SocialError("INVALID_DISPLAY_NAME")
    return normalized


def generate_public_id() -> str:
    """Return one opaque player-facing identity identifier."""
    return f"ffp_{secrets.token_urlsafe(16)}"


def generate_default_handle() -> str:
    """Return one normalized, non-reserved default public handle."""
    return f"feaster_{secrets.token_hex(4)}"


def ensure_public_identity(player: dict) -> dict:
    if player.get("public_id") and player.get("public_handle_normalized"):
        return player
    for _ in range(8):
        public_id = generate_public_id()
        handle = generate_default_handle()
        try:
            assigned = assign_public_identity(player["device_id"], public_id, handle)
        except DuplicateKeyError:
            continue
        if assigned:
            return assigned
        current = find_internal_player(player["device_id"])
        if current and current.get("public_id"):
            return current
    raise SocialError("PUBLIC_IDENTITY_UNAVAILABLE", 503)


def _rank(player: dict) -> str:
    xp = int(player.get("xp", 0))
    return "Diamond Devourer" if xp >= 5000 else "Platinum Plate" if xp >= 2000 else "Gold Glutton" if xp >= 800 else "Silver Stomach" if xp >= 200 else "Bronze Belly"


def public_profile(player: dict, friendship_state: str = "NONE") -> dict:
    return {
        "public_id": player["public_id"],
        "handle": player["public_handle"],
        "display_name": player.get("public_display_name") or "Hungry Hero",
        "avatar": sanitize_avatar(player.get("public_avatar")),
        "level": int(player.get("level", 1)),
        "rank": _rank(player),
        "wins": int(player.get("wins", 0)),
        "matches": int(player.get("matches", 0)),
        "best_score": int(player.get("best_score", 0)),
        "friendship_state": friendship_state,
    }


def own_public_profile(player: dict) -> dict:
    return public_profile(ensure_public_identity(player), "SELF")


def update_profile(player: dict, handle: str | None, display_name: str, avatar: dict) -> dict:
    current = ensure_public_identity(player)
    values = {
        "public_display_name": sanitize_display_name(display_name),
        "public_avatar": sanitize_avatar(avatar),
        "public_profile_updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if handle is not None:
        normalized = validate_handle(handle)
        owner = find_internal_player_by_handle(normalized)
        if owner and owner.get("device_id") != current["device_id"]:
            raise SocialError("HANDLE_TAKEN", 409)
        values.update({"public_handle": normalized, "public_handle_normalized": normalized})
    try:
        updated = update_public_identity(current["device_id"], values)
    except DuplicateKeyError as error:
        raise SocialError("HANDLE_TAKEN", 409) from error
    return public_profile(updated, "SELF")


def _pair_key(first: str, second: str) -> str:
    return ":".join(sorted((first, second)))


def friendship_state(viewer_id: str, target_id: str) -> str:
    if viewer_id == target_id:
        return "SELF"
    relationship = social_relationships().find_one({"pair_key": _pair_key(viewer_id, target_id)})
    if not relationship:
        return "NONE"
    if relationship["status"] == "accepted":
        return "FRIENDS"
    return "OUTGOING" if relationship["requester_public_id"] == viewer_id else "INCOMING"


def get_profile(viewer: dict, target_public_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    target = find_internal_player_by_public_id(target_public_id)
    if not target:
        raise SocialError("PLAYER_NOT_FOUND", 404)
    return public_profile(target, friendship_state(owner["public_id"], target_public_id))


def search(viewer: dict, query: str, limit: int = 12) -> list:
    owner = ensure_public_identity(viewer)
    normalized = normalize_handle(query)
    if len(normalized) < 3 or len(normalized) > 20 or not re.fullmatch(r"[a-z0-9_]+", normalized):
        raise SocialError("INVALID_SEARCH")
    return [
        public_profile(player, friendship_state(owner["public_id"], player["public_id"]))
        for player in search_public_players(normalized, owner["public_id"], min(20, max(1, limit)))
    ]


def handle_availability(viewer: dict, value: str) -> dict:
    owner = ensure_public_identity(viewer)
    normalized = validate_handle(value)
    existing = find_internal_player_by_handle(normalized)
    return {
        "handle": normalized,
        "available": existing is None or existing.get("device_id") == owner["device_id"],
    }


def send_request(viewer: dict, target_public_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    source = owner["public_id"]
    if source == target_public_id:
        raise SocialError("CANNOT_FRIEND_SELF")
    if not find_internal_player_by_public_id(target_public_id):
        raise SocialError("PLAYER_NOT_FOUND", 404)
    pair = _pair_key(source, target_public_id)
    current = social_relationships().find_one({"pair_key": pair})
    now = datetime.now(timezone.utc).isoformat()
    if current:
        if current["status"] == "accepted":
            return {"state": "FRIENDS"}
        if current["requester_public_id"] == source:
            return {"state": "OUTGOING"}
        accepted = social_relationships().find_one_and_update(
            {"pair_key": pair, "status": "pending", "requester_public_id": target_public_id},
            {"$set": {"status": "accepted", "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        return {"state": "FRIENDS" if accepted else friendship_state(source, target_public_id)}
    try:
        social_relationships().insert_one({
            "pair_key": pair, "requester_public_id": source, "recipient_public_id": target_public_id,
            "status": "pending", "created_at": now, "updated_at": now,
        })
    except DuplicateKeyError:
        raced = social_relationships().find_one({"pair_key": pair})
        if raced and raced.get("status") == "pending" and raced.get("requester_public_id") == target_public_id:
            accepted = social_relationships().find_one_and_update(
                {"pair_key": pair, "status": "pending", "requester_public_id": target_public_id},
                {"$set": {"status": "accepted", "updated_at": now}},
                return_document=ReturnDocument.AFTER,
            )
            if accepted:
                return {"state": "FRIENDS"}
        return {"state": friendship_state(source, target_public_id)}
    return {"state": "OUTGOING"}


def _pending_action(viewer: dict, target_id: str, expected_role: str, accept: bool) -> dict:
    owner = ensure_public_identity(viewer)
    source = owner["public_id"]
    role_field = "recipient_public_id" if expected_role == "incoming" else "requester_public_id"
    query = {"pair_key": _pair_key(source, target_id), "status": "pending", role_field: source}
    if accept:
        changed = social_relationships().find_one_and_update(query, {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}}, return_document=ReturnDocument.AFTER)
    else:
        changed = social_relationships().find_one_and_delete(query)
    if not changed:
        raise SocialError("REQUEST_NOT_FOUND", 404)
    return {"state": "FRIENDS" if accept else "NONE"}


def accept_request(viewer: dict, target_id: str) -> dict:
    return _pending_action(viewer, target_id, "incoming", True)


def decline_request(viewer: dict, target_id: str) -> dict:
    return _pending_action(viewer, target_id, "incoming", False)


def cancel_request(viewer: dict, target_id: str) -> dict:
    return _pending_action(viewer, target_id, "outgoing", False)


def remove_friend(viewer: dict, target_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    deleted = social_relationships().find_one_and_delete({"pair_key": _pair_key(owner["public_id"], target_id), "status": "accepted"})
    if not deleted:
        raise SocialError("FRIEND_NOT_FOUND", 404)
    return {"state": "NONE"}


def list_relationships(viewer: dict) -> dict:
    owner = ensure_public_identity(viewer)
    public_id = owner["public_id"]
    documents = list(social_relationships().find({"$or": [{"requester_public_id": public_id}, {"recipient_public_id": public_id}]}))
    ids = {doc["recipient_public_id"] if doc["requester_public_id"] == public_id else doc["requester_public_id"] for doc in documents}
    players = {player["public_id"]: player for player in public_players_by_ids(list(ids))}
    result = {"friends": [], "incoming": [], "outgoing": []}
    for doc in documents:
        other_id = doc["recipient_public_id"] if doc["requester_public_id"] == public_id else doc["requester_public_id"]
        other = players.get(other_id)
        if not other:
            continue
        if doc["status"] == "accepted":
            result["friends"].append(public_profile(other, "FRIENDS"))
        elif doc["recipient_public_id"] == public_id:
            result["incoming"].append(public_profile(other, "INCOMING"))
        else:
            result["outgoing"].append(public_profile(other, "OUTGOING"))
    return result
