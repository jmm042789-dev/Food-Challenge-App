"""
Fire Feast Player Service

All player-related logic belongs here.

Eventually server.py should only call these functions.
"""

from database import (
    create_or_get_player,
    find_player_document,
    update_player_document,
)


WELCOME_REWARD = {
    "coins": 200,
    "antacid": 1,
    "xp": 50,
}
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

        "coins": 0,

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


def claim_welcome_reward(device_id: str):
    """
    Grants the one-time welcome reward to an eligible existing player.
    """

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
