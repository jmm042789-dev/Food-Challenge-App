"""Canonical public identity and avatar projection helpers."""

import re
import secrets

from pymongo.errors import DuplicateKeyError

from database import assign_public_identity, find_internal_player


HANDLE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,19}$")
RESERVED_HANDLES = {"admin", "administrator", "firefeast", "moderator", "support", "system"}
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
