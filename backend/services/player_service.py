"""
Fire Feast Player Service

All player-related logic belongs here.

Eventually server.py should only call these functions.
"""

from database import players

# ==========================================================
# PLAYER CREATION
# ==========================================================

def create_player(device_id: str):
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
    }

    players[device_id] = player

    return player


def find_player(device_id: str):
    """
    Return a player if they exist.
    """

    return players.get(device_id)


def get_or_create_player(device_id: str):
    """
    Gets an existing player or creates one if missing.
    """

    if device_id not in players:
        return create_player(device_id)

    return players[device_id]


def apply_match_result(device_id: str, opponent_id: str, won: bool):
    """
    Applies match results to both players.
    """

    player = find_player(device_id)
    opponent = find_player(opponent_id)

    if not player or not opponent:
        return None

    if won:
        record_win(device_id)
        record_loss(opponent_id)

        player["coins"] += 50
        player["xp"] += 25
    else:
        record_loss(device_id)
        record_win(opponent_id)

        player["xp"] += 10

    return player


# ==========================================================
# PLAYER LOOKUP
# ==========================================================

def get_player(device_id: str):
    """
    Returns a player.

    Creates one automatically if needed.
    """

    if device_id not in players:
        return create_player(device_id)

    return players[device_id]


# ==========================================================
# COINS
# ==========================================================

def add_coins(device_id: str, amount: int):

    player = get_player(device_id)

    player["coins"] += amount

    return player["coins"]


# ==========================================================
# XP
# ==========================================================

def add_xp(device_id: str, amount: int):

    player = get_player(device_id)

    player["xp"] += amount

    check_level_up(player)

    return player["xp"]


# ==========================================================
# ANTACID
# ==========================================================

def add_antacid(device_id: str, amount: int):

    player = get_player(device_id)

    player["antacid"] += amount

    return player["antacid"]


# ==========================================================
# MATCHES
# ==========================================================

def record_win(device_id: str):

    player = get_player(device_id)

    player["wins"] += 1

    player["matches"] += 1

    player["elo"] += 25

    return player


def record_loss(device_id: str):

    player = get_player(device_id)

    player["losses"] += 1

    player["matches"] += 1

    player["elo"] -= 10

    return player


# ==========================================================
# SCORE
# ==========================================================

def update_best_score(device_id: str, score: int):

    player = get_player(device_id)

    if score > player["best_score"]:
        player["best_score"] = score

    return player["best_score"]


def update_combo(device_id: str, combo: int):

    player = get_player(device_id)

    if combo > player["longest_combo"]:
        player["longest_combo"] = combo

    return player["longest_combo"]


# ==========================================================
# LEVELING
# ==========================================================

def xp_needed(level: int):

    return level * 100


def check_level_up(player):

    while player["xp"] >= xp_needed(player["level"]):

        player["xp"] -= xp_needed(player["level"])

        player["level"] += 1

        player["coins"] += 100


# ==========================================================
# GEAR
# ==========================================================

def unlock_gear(device_id: str, gear_id: str):

    player = get_player(device_id)

    if gear_id not in player["owned_gear"]:

        player["owned_gear"].append(gear_id)

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