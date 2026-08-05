"""
Fire Feast Player Service

All player-related logic belongs here.

Eventually server.py should only call these functions.
"""

import uuid
import logging
import os
import hmac
from datetime import datetime, timedelta, timezone

from database import (
    create_guest_player,
    create_or_get_player,
    complete_guest_bootstrap,
    find_internal_player_by_installation_hash,
    find_player_document,
    installation_has_guest,
    public_player_document,
    recover_guest_credentials,
    update_player_document,
)
from auth import (
    AUTH_TOKEN_VERSION,
    generate_auth_token,
    hash_auth_token,
    hash_installation_id,
    hash_recovery_nonce,
)
from config import DEFAULT_GUEST_RECOVERY_WINDOW_SECONDS, DEFAULT_STARTING_COINS


logger = logging.getLogger(__name__)
COIN_DEBUG_LOGGING = os.environ.get("FIRE_FEAST_ENV", "development").lower() == "development"


WELCOME_REWARD = {
    "coins": 200,
    "antacid": 1,
    "xp": 50,
}


class BootstrapAlreadyCompletedError(Exception):
    pass


class BootstrapRecoveryError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def bootstrap_guest(
    installation_id: str,
    recovery_nonce: str,
    *,
    now: datetime | None = None,
    recovery_window_seconds: int = DEFAULT_GUEST_RECOVERY_WINDOW_SECONDS,
) -> dict:
    """Create one authenticated guest for an installation.

    A repeated unauthenticated bootstrap never returns or rotates credentials.
    This prevents replay from minting additional valid tokens.
    """
    installation_hash = hash_installation_id(installation_id)
    if installation_has_guest(installation_hash):
        raise BootstrapAlreadyCompletedError

    player_id = f"guest_{uuid.uuid4().hex}"
    auth_token = generate_auth_token()
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    created_at = current.isoformat()
    document = _new_player(player_id)
    document.update(
        {
            "player_id": player_id,
            "auth_token_hash": hash_auth_token(auth_token),
            "installation_id_hash": installation_hash,
            "token_created_at": created_at,
            "token_version": AUTH_TOKEN_VERSION,
            "bootstrap_recovery_nonce_hash": hash_recovery_nonce(recovery_nonce),
            "bootstrap_recovery_expires_at": (
                current + timedelta(seconds=recovery_window_seconds)
            ).isoformat(),
        }
    )
    player = create_guest_player(document)
    if player is None:
        raise BootstrapAlreadyCompletedError
    if COIN_DEBUG_LOGGING:
        logger.info(
            "Coin bootstrap player=%s starting_balance=%s",
            player_id,
            player.get("coins"),
        )
    return {
        "player": player,
        "player_id": player_id,
        "auth_token": auth_token,
        "migrated": False,
        "recovery_expires_at": document["bootstrap_recovery_expires_at"],
    }


def recover_guest_bootstrap(
    installation_id: str,
    recovery_nonce: str,
    new_auth_token: str,
    *,
    now: datetime | None = None,
) -> dict:
    """Consume a recovery nonce and atomically rotate to a client-held bearer."""
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    installation_hash = hash_installation_id(installation_id)
    nonce_hash = hash_recovery_nonce(recovery_nonce)
    rotated = recover_guest_credentials(
        installation_hash,
        nonce_hash,
        current.isoformat(),
        hash_auth_token(new_auth_token),
        current.isoformat(),
    )
    if rotated:
        player_id = rotated.get("player_id") or rotated["device_id"]
        return {
            "player": public_player_document(rotated),
            "player_id": player_id,
            "recovered": True,
        }

    existing = find_internal_player_by_installation_hash(installation_hash)
    if not existing:
        raise BootstrapRecoveryError(
            "GUEST_RECOVERY_NOT_FOUND",
            "No recoverable guest account was found for this installation.",
        )
    expected_nonce_hash = existing.get("bootstrap_recovery_nonce_hash")
    if not isinstance(expected_nonce_hash, str):
        raise BootstrapRecoveryError(
            "GUEST_RECOVERY_USED",
            "Guest recovery has already been used or completed.",
        )
    if not hmac.compare_digest(expected_nonce_hash, nonce_hash):
        raise BootstrapRecoveryError(
            "GUEST_RECOVERY_INVALID",
            "The guest recovery credential is invalid.",
        )
    expires_at = existing.get("bootstrap_recovery_expires_at")
    try:
        expiration = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        expiration = expiration.astimezone(timezone.utc)
    except (TypeError, ValueError):
        expiration = current
    if current >= expiration:
        raise BootstrapRecoveryError(
            "GUEST_RECOVERY_EXPIRED",
            "Guest recovery has expired. Clear the app's local data to create a new guest account.",
        )
    raise BootstrapRecoveryError(
        "GUEST_RECOVERY_CONFLICT",
        "Guest recovery could not be completed. Retry with the pending recovery credential.",
    )


def finish_guest_bootstrap(player: dict) -> dict:
    """Clear recovery state only after bearer-authenticated client confirmation."""
    completed = complete_guest_bootstrap(
        player["device_id"],
        player["auth_token_hash"],
    )
    return {"completed": completed is not None}
class TutorialIncompleteError(Exception):
    pass


class WelcomeRewardUnavailableError(Exception):
    pass

# ==========================================================
# PLAYER CREATION
# ==========================================================

def _new_player(device_id: str):
    """
    Creates a brand-new player.
    """

    player = {
        "device_id": device_id,

        "coins": DEFAULT_STARTING_COINS,

        "antacid": 0,

        "xp": 0,

        "level": 1,

        "elo": 1000,

        "wins": 0,

        "losses": 0,

        "matches": 0,

        "best_score": 0,

        "longest_combo": 0,

        "owned_gear": [],

        "last_claim_date": None,

        "streak_days": 0,

        "tutorial_done": False,

        "welcome_reward_claimed": False,

        "closed_beta_welcome_pack_claimed": False,

        "last_daily_spin": None,

        "next_daily_spin": None,

        "daily_spin_streak": 0,

        "total_daily_spins": 0,

        "bonus_spins": 0,
    }

    return player


def create_player(device_id: str):
    return create_or_get_player(_new_player(device_id))


def find_player(device_id: str):
    """
    Return a player if they exist.
    """

    return find_player_document(device_id)


def get_or_create_player(device_id: str):
    """
    Gets an existing player or creates one if missing.
    """

    return create_or_get_player(_new_player(device_id))


def mark_tutorial_done(device_id: str):
    """
    Marks an existing player's tutorial as complete.
    """

    player = find_player(device_id)

    if not player:
        return None

    return update_player_document(
        device_id,
        {"$set": {"tutorial_done": True}},
    )


def update_player_profile(device_id: str, values: dict):
    allowed = {
        key: value
        for key, value in values.items()
        if key in {"username", "country", "avatar_emoji"} and value is not None
    }
    if not allowed:
        return find_player(device_id)
    return update_player_document(device_id, {"$set": allowed})


def claim_welcome_reward(device_id: str):
    """
    Grants the one-time welcome reward to an eligible existing player.
    """

    before = find_player(device_id)
    player = update_player_document(
        device_id,
        {
            "$inc": WELCOME_REWARD,
            "$set": {"welcome_reward_claimed": True},
        },
        extra_filter={
            "tutorial_done": True,
            "welcome_reward_claimed": False,
        },
    )
    if player:
        if COIN_DEBUG_LOGGING:
            logger.info(
                "Coin reward player=%s reward=%s before=%s after=%s",
                device_id,
                WELCOME_REWARD["coins"],
                (before or {}).get("coins"),
                player.get("coins"),
            )
        return {
            "player": player,
            "granted": True,
            "reward": dict(WELCOME_REWARD),
        }

    player = find_player(device_id)
    if not player:
        return None
    if player.get("tutorial_done") is not True:
        raise TutorialIncompleteError
    if player.get("welcome_reward_claimed") is True:
        return {
            "player": player,
            "granted": False,
            "reward": {"coins": 0, "antacid": 0, "xp": 0},
        }
    raise WelcomeRewardUnavailableError


# ==========================================================
# PLAYER LOOKUP
# ==========================================================

def get_player(device_id: str):
    """
    Returns a player.

    Creates one automatically if needed.
    """

    return get_or_create_player(device_id)


# ==========================================================
# COINS
# ==========================================================

def add_coins(device_id: str, amount: int):

    get_or_create_player(device_id)
    player = update_player_document(device_id, {"$inc": {"coins": amount}})
    return player["coins"]


# ==========================================================
# XP
# ==========================================================

def add_xp(device_id: str, amount: int):

    get_or_create_player(device_id)
    player = update_player_document(device_id, {"$inc": {"xp": amount}})
    player = check_level_up(player)
    return player["xp"]


# ==========================================================
# ANTACID
# ==========================================================

def add_antacid(device_id: str, amount: int):

    get_or_create_player(device_id)
    player = update_player_document(device_id, {"$inc": {"antacid": amount}})
    return player["antacid"]


# ==========================================================
# MATCHES
# ==========================================================

def record_win(device_id: str):

    get_or_create_player(device_id)
    return update_player_document(
        device_id,
        {"$inc": {"wins": 1, "matches": 1, "elo": 25}},
    )


def record_loss(device_id: str):

    get_or_create_player(device_id)
    return update_player_document(
        device_id,
        {"$inc": {"losses": 1, "matches": 1, "elo": -10}},
    )


# ==========================================================
# SCORE
# ==========================================================

def update_best_score(device_id: str, score: int):

    get_or_create_player(device_id)
    player = update_player_document(device_id, {"$max": {"best_score": score}})
    return player["best_score"]


def update_combo(device_id: str, combo: int):

    get_or_create_player(device_id)
    player = update_player_document(device_id, {"$max": {"longest_combo": combo}})
    return player["longest_combo"]


# ==========================================================
# LEVELING
# ==========================================================

def xp_needed(level: int):

    return level * 100


def check_level_up(player):
    while player["xp"] >= xp_needed(player["level"]):
        level = player["level"]
        player = update_player_document(
            player["device_id"],
            {
                "$inc": {
                    "xp": -xp_needed(level),
                    "level": 1,
                    "coins": 100,
                }
            },
            extra_filter={"level": level, "xp": {"$gte": xp_needed(level)}},
        ) or find_player(player["device_id"])
    return player


# ==========================================================
# GEAR
# ==========================================================

def unlock_gear(device_id: str, gear_id: str):

    get_or_create_player(device_id)
    player = update_player_document(
        device_id,
        {"$addToSet": {"owned_gear": gear_id}},
    )
    return player["owned_gear"]


# ==========================================================
# PLAYER SUMMARY
# ==========================================================

def player_summary(device_id: str):

    player = get_player(device_id)

    return {

        "device_id": player["device_id"],

        "level": player["level"],

        "xp": player["xp"],

        "coins": player["coins"],

        "antacid": player["antacid"],

        "elo": player["elo"],

        "wins": player["wins"],

        "losses": player["losses"],

        "matches": player["matches"],

        "best_score": player["best_score"],

        "longest_combo": player["longest_combo"],

        "owned_gear": player["owned_gear"],

    }
