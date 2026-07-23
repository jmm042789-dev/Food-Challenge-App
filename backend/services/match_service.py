"""Server-authoritative AI match lifecycle and progression updates."""

import random
import uuid
from datetime import datetime, timezone

from data.contests import get_contest
from data.opponents import OPPONENTS
from database import find_internal_player, settle_player_match, start_player_match


BELT_RANKS = [
    {"key": "bronze", "name": "Bronze Belly", "min_xp": 0, "color": "#CD7F32", "icon": "🥉"},
    {"key": "silver", "name": "Silver Stomach", "min_xp": 200, "color": "#C0C0C0", "icon": "🥈"},
    {"key": "gold", "name": "Gold Glutton", "min_xp": 800, "color": "#FFB800", "icon": "🥇"},
    {"key": "platinum", "name": "Platinum Plate", "min_xp": 2000, "color": "#E5E4E2", "icon": "🏆"},
    {"key": "diamond", "name": "Diamond Devourer", "min_xp": 5000, "color": "#7AB8FF", "icon": "💎"},
]


class PlayerNotFoundError(Exception):
    pass


class ContestNotFoundError(Exception):
    pass


class InsufficientCoinsError(Exception):
    pass


class MatchAlreadyActiveError(Exception):
    pass


class MatchNotFoundError(Exception):
    pass


class MatchValidationError(Exception):
    pass


def belt_for_xp(xp: int) -> dict:
    current = BELT_RANKS[0]
    for rank in BELT_RANKS:
        if xp >= rank["min_xp"]:
            current = rank
    return dict(current)


def _opponent_for(contest: dict) -> dict:
    candidates = [
        opponent
        for opponent in OPPONENTS
        if opponent["difficulty"].lower() == contest["difficulty"].lower()
    ] or OPPONENTS
    return dict(random.choice(candidates))


def _opponent_pace(opponent: dict, contest: dict) -> float:
    difficulty_multiplier = {
        "easy": 6,
        "medium": 8,
        "hard": 9.5,
        "legendary": 11,
    }.get(contest["difficulty"].lower(), 6)
    return float(opponent.get("tap_speed", 1)) * difficulty_multiplier


def _equipped_perk(player: dict):
    return player.get("equipped_gear")


def start_match(device_id: str, contest_id: str) -> dict:
    player = find_internal_player(device_id)
    if not player:
        raise PlayerNotFoundError

    contest = get_contest(contest_id)
    if not contest:
        raise ContestNotFoundError

    active = player.get("active_match")
    if active:
        if active.get("contest_id") == contest_id:
            return dict(active["start_response"])
        raise MatchAlreadyActiveError

    opponent = _opponent_for(contest)
    entry_fee = int(contest.get("entry_fee", 0))
    new_coins = int(player.get("coins", 0)) - entry_fee
    response = {
        "contest": contest,
        "opponent": opponent,
        "opp_pace_per_sec": _opponent_pace(opponent, contest),
        "player_tums": int(player.get("antacid", 0)),
        "player_coins": new_coins,
        "equipped_gear": player.get("equipped_gear"),
        "equipped_perk": _equipped_perk(player),
    }
    match = {
        "id": str(uuid.uuid4()),
        "device_id": device_id,
        "contest_id": contest_id,
        "opponent_id": opponent["id"],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "start_response": response,
    }
    updated = start_player_match(device_id, entry_fee, match)
    if updated:
        return response

    latest = find_internal_player(device_id)
    if not latest:
        raise PlayerNotFoundError
    latest_active = latest.get("active_match")
    if latest_active and latest_active.get("contest_id") == contest_id:
        return dict(latest_active["start_response"])
    if int(latest.get("coins", 0)) < entry_fee:
        raise InsufficientCoinsError
    raise MatchAlreadyActiveError


def _fingerprint(result) -> dict:
    return {
        "contest_id": result.contest_id,
        "score": result.score,
        "duration_sec": result.duration_sec,
        "won": result.won,
        "opponent_id": result.opponent_id,
        "tums_used": result.tums_used,
        "is_tournament": result.is_tournament,
    }


def submit_result(result) -> dict:
    player = find_internal_player(result.device_id)
    if not player:
        raise PlayerNotFoundError

    fingerprint = _fingerprint(result)
    active = player.get("active_match")
    if not active:
        previous = player.get("last_match_result") or {}
        if previous.get("fingerprint") == fingerprint:
            return dict(previous["response"])
        raise MatchNotFoundError

    contest = get_contest(result.contest_id)
    if not contest or active.get("contest_id") != result.contest_id:
        raise MatchValidationError
    if active.get("opponent_id") != result.opponent_id:
        raise MatchValidationError
    if result.score < 0 or result.duration_sec < 0 or result.tums_used < 0:
        raise MatchValidationError
    if result.duration_sec > int(contest.get("duration_sec", 0)) + 10:
        raise MatchValidationError

    coin_reward = int(contest.get("prize_pool", 0)) if result.won else 10
    xp_reward = 50 if result.won else 15
    old_xp = int(player.get("xp", 0))
    new_xp = old_xp + xp_reward
    old_belt = belt_for_xp(old_xp)
    new_belt = belt_for_xp(new_xp)
    response = {
        "coin_reward": coin_reward,
        "xp_reward": xp_reward,
        "new_coins": {"$add": [{"$ifNull": ["$coins", 0]}, coin_reward]},
        "new_xp": {"$add": [{"$ifNull": ["$xp", 0]}, xp_reward]},
        "new_best": {"$max": [{"$ifNull": ["$best_score", 0]}, result.score]},
        "new_tums": {
            "$max": [0, {"$subtract": [{"$ifNull": ["$antacid", 0]}, result.tums_used]}]
        },
        "leveled_up": old_belt["key"] != new_belt["key"],
        "new_belt": new_belt,
    }
    update_pipeline = [
        {
            "$set": {
                "coins": response["new_coins"],
                "xp": response["new_xp"],
                "wins": {"$add": [{"$ifNull": ["$wins", 0]}, 1 if result.won else 0]},
                "losses": {"$add": [{"$ifNull": ["$losses", 0]}, 0 if result.won else 1]},
                "matches": {"$add": [{"$ifNull": ["$matches", 0]}, 1]},
                "best_score": response["new_best"],
                "antacid": response["new_tums"],
                "elo": {"$add": [{"$ifNull": ["$elo", 1000]}, 25 if result.won else -10]},
                "last_match_result": {
                    "match_id": active["id"],
                    "fingerprint": fingerprint,
                    "response": response,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
                "active_match": "$$REMOVE",
            }
        }
    ]
    settled = settle_player_match(result.device_id, active["id"], update_pipeline)
    if settled:
        return dict(settled["last_match_result"]["response"])

    latest = find_internal_player(result.device_id) or {}
    previous = latest.get("last_match_result") or {}
    if previous.get("fingerprint") == fingerprint:
        return dict(previous["response"])
    raise MatchNotFoundError
