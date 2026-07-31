"""Server-authoritative AI match lifecycle and progression updates."""

import random
import uuid
import logging
import os
import math
from datetime import datetime, timedelta, timezone

from data.contests import get_contest
from data.opponents import OPPONENTS
from database import (
    active_matches,
    find_internal_player,
    queue,
    settle_player_match,
    start_player_match,
    transition_player_match,
)


MATCH_RECOVERY_WINDOW_SECONDS = 15 * 60
MATCHMAKING_QUEUE_TTL_SECONDS = 2 * 60
MATCH_SUBMISSION_GRACE_SECONDS = 2 * 60
MATCH_START_CLOCK_TOLERANCE_SECONDS = 8
MATCH_DURATION_TOLERANCE_SECONDS = 8
MAX_PLAUSIBLE_TAPS_PER_SECOND = 20
TAP_BURST_ALLOWANCE = 30
PROGRESS_ABSOLUTE_TOLERANCE = 2.0
SCORE_BOUND_TOLERANCE = 1.35
SCORE_ABSOLUTE_TOLERANCE = 100
MAX_SAFE_MATCH_SCORE = 10_000_000
MATCH_SCHEMA_VERSION = 2
logger = logging.getLogger(__name__)
COIN_DEBUG_LOGGING = os.environ.get("FIRE_FEAST_ENV", "development").lower() == "development"


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
    def __init__(self, reason: str = "malformed"):
        self.reason = reason
        super().__init__(reason)


class MatchExpiredError(Exception):
    pass


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_server_timestamp(value) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _match_is_stale(active: dict, now: datetime | None = None) -> bool:
    if active.get("status", "active") != "active":
        return True
    if not isinstance(active.get("id"), str) or not active.get("id"):
        return True
    started_at = _parse_server_timestamp(active.get("started_at"))
    if started_at is None:
        return True
    current = now or _utc_now()
    if started_at > current + timedelta(seconds=60):
        return True
    expires_at = _parse_server_timestamp(active.get("expires_at"))
    if expires_at is not None:
        return current >= expires_at
    return current - started_at >= timedelta(seconds=MATCH_RECOVERY_WINDOW_SECONDS)


BASE_PERK_MODIFIERS = {
    "tap_power": 1.0,
    "combo_window_ms": 700,
    "score_multiplier": 1.0,
    "heat_generation_multiplier": 1.0,
}
GEAR_PERK_MODIFIERS = {
    "tap_boost": {
        "tap_power": 2.0,
        "combo_window_ms": 700,
        "score_multiplier": 1.0,
        "heat_generation_multiplier": 1.1,
    },
    "combo_boost": {
        "tap_power": 1.0,
        "combo_window_ms": 875,
        "score_multiplier": 1.0,
        "heat_generation_multiplier": 1.0,
    },
    "score_multiplier": {
        "tap_power": 1.0,
        "combo_window_ms": 700,
        "score_multiplier": 1.5,
        "heat_generation_multiplier": 1.15,
    },
}


def authoritative_perk_config(equipped_gear) -> tuple[str | None, dict]:
    """Resolve one persisted gear identifier; unknown gear receives base stats."""
    if equipped_gear not in GEAR_PERK_MODIFIERS:
        return None, dict(BASE_PERK_MODIFIERS)
    return equipped_gear, dict(GEAR_PERK_MODIFIERS[equipped_gear])


def _remove_player_matchmaking_state(device_id: str) -> None:
    queue[:] = [entry for entry in queue if entry.get("device_id") != device_id]
    stale_ids = [
        match_id
        for match_id, match in active_matches.items()
        if device_id in match.get("players", [])
    ]
    for match_id in stale_ids:
        active_matches.pop(match_id, None)


def cleanup_stale_matchmaking_state(now_epoch: float | None = None) -> None:
    """Discard process-local searches and pairings that cannot be recovered."""
    current = _utc_now().timestamp() if now_epoch is None else now_epoch
    queue[:] = [
        entry
        for entry in queue
        if isinstance(entry.get("time"), (int, float))
        and current - float(entry["time"]) < MATCHMAKING_QUEUE_TTL_SECONDS
    ]
    stale_ids = [
        match_id
        for match_id, match in active_matches.items()
        if not isinstance(match.get("created"), (int, float))
        or current - float(match["created"]) >= MATCHMAKING_QUEUE_TTL_SECONDS
    ]
    for match_id in stale_ids:
        active_matches.pop(match_id, None)


def expire_stale_match(device_id: str, now: datetime | None = None) -> bool:
    player = find_internal_player(device_id)
    active = player.get("active_match") if player else None
    if not active or not _match_is_stale(active, now):
        return False
    match_id = active.get("id")
    ended_at = (now or _utc_now()).isoformat()
    transitioned = transition_player_match(device_id, match_id, "expired", ended_at)
    if transitioned:
        _remove_player_matchmaking_state(device_id)
        return True
    return False


def recover_match(device_id: str) -> dict:
    player = find_internal_player(device_id)
    if not player:
        raise PlayerNotFoundError
    if expire_stale_match(device_id):
        return {"status": "expired"}
    player = find_internal_player(device_id) or {}
    active = player.get("active_match")
    if active:
        return {
            "status": "resumable",
            "match_id": active.get("id"),
            "contest_id": active.get("contest_id"),
            "started_at": active.get("started_at"),
        }
    previous = player.get("last_match_lifecycle") or {}
    status = previous.get("status")
    if status in {"expired", "cancelled", "rejected", "settled"}:
        return {"status": status}
    return {"status": "absent"}


def cancel_match(device_id: str) -> dict:
    player = find_internal_player(device_id)
    if not player:
        raise PlayerNotFoundError
    if expire_stale_match(device_id):
        return {"status": "expired"}
    player = find_internal_player(device_id) or {}
    active = player.get("active_match")
    if not active:
        previous = player.get("last_match_lifecycle") or {}
        status = previous.get("status")
        return {
            "status": status
            if status in {"cancelled", "expired", "rejected", "settled"}
            else "absent"
        }
    match_id = active.get("id")
    if not isinstance(match_id, str) or not match_id:
        raise MatchValidationError
    transitioned = transition_player_match(
        device_id,
        match_id,
        "cancelled",
        _utc_now().isoformat(),
    )
    if transitioned:
        _remove_player_matchmaking_state(device_id)
        return {"status": "cancelled"}
    return recover_match(device_id)


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


def start_match(device_id: str, contest_id: str) -> dict:
    player = find_internal_player(device_id)
    if not player:
        raise PlayerNotFoundError

    contest = get_contest(contest_id)
    if not contest:
        raise ContestNotFoundError

    expire_stale_match(device_id)
    player = find_internal_player(device_id)
    if not player:
        raise PlayerNotFoundError
    active = player.get("active_match")
    if active:
        if active.get("contest_id") == contest_id:
            return dict(active["start_response"])
        raise MatchAlreadyActiveError

    opponent = _opponent_for(contest)
    entry_fee = int(contest.get("entry_fee", 0))
    new_coins = int(player.get("coins", 0)) - entry_fee
    match_id = str(uuid.uuid4())
    started_at = _utc_now()
    allowed_duration = int(contest.get("duration_sec", 0))
    expires_at = started_at + timedelta(
        seconds=allowed_duration + MATCH_SUBMISSION_GRACE_SECONDS
    )
    equipped_gear, perk_modifiers = authoritative_perk_config(
        player.get("equipped_gear")
    )
    response = {
        "match_id": match_id,
        "contest": contest,
        "opponent": opponent,
        "opp_pace_per_sec": _opponent_pace(opponent, contest),
        "player_tums": int(player.get("antacid", 0)),
        "player_coins": new_coins,
        "equipped_gear": equipped_gear,
        "perk_modifiers": perk_modifiers,
        "authoritative_duration_sec": allowed_duration,
        "server_started_at": started_at.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    match = {
        "schema_version": MATCH_SCHEMA_VERSION,
        "id": match_id,
        "device_id": device_id,
        "player_id": player.get("player_id", device_id),
        "contest_id": contest_id,
        "opponent_id": opponent["id"],
        "status": "active",
        "started_at": started_at.isoformat(),
        "allowed_duration_sec": allowed_duration,
        "expires_at": expires_at.isoformat(),
        "challenge_config": {
            "contest_id": contest_id,
            "duration_sec": allowed_duration,
            "difficulty": contest.get("difficulty"),
            "bite_mechanic": contest.get("bite_mechanic"),
            "heartburn_per_bite": contest.get("heartburn_per_bite", 0),
            "prize_pool": int(contest.get("prize_pool", 0)),
        },
        "equipped_gear": equipped_gear,
        "perk_modifiers": perk_modifiers,
        "starting_antacid": int(player.get("antacid", 0)),
        "entry_fee_charged": entry_fee,
        "starting_progression": {
            "coins": int(player.get("coins", 0)),
            "xp": int(player.get("xp", 0)),
            "elo": int(player.get("elo", 1000)),
        },
        "opponent_pace_per_sec": response["opp_pace_per_sec"],
        "start_response": response,
    }
    updated = start_player_match(device_id, entry_fee, match)
    if updated:
        response["player_coins"] = int(updated.get("coins", 0))
        if COIN_DEBUG_LOGGING:
            logger.info(
                "Coin match entry player=%s purchase_amount=%s balance_after=%s",
                device_id,
                entry_fee,
                response["player_coins"],
            )
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
        "opponent_score": result.opponent_score,
        "duration_sec": result.duration_sec,
        "accepted_taps": result.accepted_taps,
        "completed_progress": result.completed_progress,
        "maximum_combo": result.maximum_combo,
        "opponent_id": result.opponent_id,
        "tums_used": result.tums_used,
        "completion_reason": result.completion_reason,
        "is_tournament": result.is_tournament,
    }


def _reject_match(device_id: str, active: dict, reason: str, telemetry: dict) -> None:
    now = _utc_now().isoformat()
    transition_player_match(
        device_id,
        active.get("id"),
        "rejected",
        now,
        rejection_reason=reason,
    )
    logger.warning(
        "Match validation player=%s match=%s outcome=rejected reason=%s telemetry=%s",
        device_id,
        active.get("id"),
        reason,
        telemetry,
    )
    raise MatchValidationError(reason)


def _plausibility_bounds(active: dict, result, server_elapsed: float) -> dict:
    duration = int(active["allowed_duration_sec"])
    perk = active.get("perk_modifiers")
    if not isinstance(perk, dict):
        _, perk = authoritative_perk_config(active.get("equipped_gear"))
    tap_power = float(perk.get("tap_power", 1))
    score_multiplier = float(perk.get("score_multiplier", 1))
    validation_duration = min(
        duration + MATCH_DURATION_TOLERANCE_SECONDS,
        max(float(result.duration_sec), min(server_elapsed, duration)),
    )
    maximum_taps = math.ceil(
        validation_duration * MAX_PLAUSIBLE_TAPS_PER_SECOND + TAP_BURST_ALLOWANCE
    )
    maximum_progress = maximum_taps * tap_power + PROGRESS_ABSOLUTE_TOLERANCE

    # This deliberately assumes perfect combos, the highest heat-tier bonus,
    # continuous Fresh Stomach, and no overheat loss. Those assumptions make
    # the hard bound generous enough for fast/accessibility-assisted players.
    # The 1.35 tolerance also covers frame batching and score rounding, while
    # still rejecting multipliers or tap rates outside Fire Feast's rules.
    maximum_points_per_tap = (
        3.0 * tap_power * 1.5 * score_multiplier * 1.1
    )
    maximum_score = math.ceil(
        maximum_taps * maximum_points_per_tap * SCORE_BOUND_TOLERANCE
        + SCORE_ABSOLUTE_TOLERANCE
    )
    submitted_tap_score = math.ceil(
        result.accepted_taps
        * maximum_points_per_tap
        * SCORE_BOUND_TOLERANCE
        + SCORE_ABSOLUTE_TOLERANCE
    )
    return {
        "maximum_taps": maximum_taps,
        "maximum_progress": maximum_progress,
        "maximum_score": min(MAX_SAFE_MATCH_SCORE, maximum_score),
        "submitted_tap_score": min(MAX_SAFE_MATCH_SCORE, submitted_tap_score),
    }


def _validate_result(active: dict, result, now: datetime) -> tuple[dict, str]:
    telemetry = _fingerprint(result)
    if active.get("schema_version") != MATCH_SCHEMA_VERSION:
        _reject_match(result.device_id, active, "invalid_match_state", telemetry)
    if active.get("device_id") != result.device_id:
        _reject_match(result.device_id, active, "ownership_mismatch", telemetry)
    if active.get("status") != "active":
        _reject_match(result.device_id, active, "invalid_match_state", telemetry)
    if active.get("contest_id") != result.contest_id:
        _reject_match(result.device_id, active, "malformed", telemetry)
    if active.get("opponent_id") != result.opponent_id:
        _reject_match(result.device_id, active, "malformed", telemetry)

    started_at = _parse_server_timestamp(active.get("started_at"))
    expires_at = _parse_server_timestamp(active.get("expires_at"))
    allowed_duration = active.get("allowed_duration_sec")
    if (
        started_at is None
        or expires_at is None
        or not isinstance(allowed_duration, int)
        or allowed_duration <= 0
    ):
        _reject_match(result.device_id, active, "invalid_match_state", telemetry)
    if now >= expires_at:
        _reject_match(result.device_id, active, "expired", telemetry)

    server_elapsed = (now - started_at).total_seconds()
    if server_elapsed < 0:
        _reject_match(result.device_id, active, "impossible_timing", telemetry)
    if result.completion_reason != "timer_completed":
        _reject_match(result.device_id, active, "invalid_match_state", telemetry)
    if (
        result.duration_sec
        < allowed_duration - MATCH_DURATION_TOLERANCE_SECONDS
        or server_elapsed
        < allowed_duration - MATCH_START_CLOCK_TOLERANCE_SECONDS
    ):
        _reject_match(result.device_id, active, "impossible_timing", telemetry)
    if (
        result.duration_sec > allowed_duration + MATCH_DURATION_TOLERANCE_SECONDS
        or abs(server_elapsed - result.duration_sec)
        > MATCH_SUBMISSION_GRACE_SECONDS + MATCH_START_CLOCK_TOLERANCE_SECONDS
    ):
        _reject_match(result.device_id, active, "impossible_timing", telemetry)

    starting_antacid = active.get("starting_antacid")
    if (
        not isinstance(starting_antacid, int)
        or result.tums_used > starting_antacid
        or result.tums_used > math.floor(result.duration_sec / 2) + 1
    ):
        _reject_match(result.device_id, active, "invalid_inventory", telemetry)

    bounds = _plausibility_bounds(active, result, server_elapsed)
    if result.accepted_taps > bounds["maximum_taps"]:
        _reject_match(result.device_id, active, "impossible_taps", telemetry)
    if result.maximum_combo > result.accepted_taps:
        _reject_match(result.device_id, active, "impossible_progress", telemetry)
    trusted_tap_power = float(active["perk_modifiers"]["tap_power"])
    submitted_progress_bound = (
        result.accepted_taps * trusted_tap_power + PROGRESS_ABSOLUTE_TOLERANCE
    )
    if (
        result.completed_progress > submitted_progress_bound
        or result.completed_progress > bounds["maximum_progress"]
    ):
        _reject_match(result.device_id, active, "impossible_progress", telemetry)
    if (
        result.score > bounds["maximum_score"]
        or result.score > bounds["submitted_tap_score"]
    ):
        _reject_match(result.device_id, active, "impossible_score", telemetry)
    if result.opponent_score > bounds["maximum_score"]:
        _reject_match(result.device_id, active, "impossible_score", telemetry)

    outcome = (
        "suspicious_but_accepted"
        if result.score >= bounds["maximum_score"] * 0.8
        else "accepted"
    )
    logger.info(
        "Match validation player=%s match=%s outcome=%s duration=%s "
        "score=%s taps=%s progress=%s bounds=%s",
        result.device_id,
        active.get("id"),
        outcome,
        result.duration_sec,
        result.score,
        result.accepted_taps,
        result.completed_progress,
        bounds,
    )
    return bounds, outcome


def submit_result(result) -> dict:
    player = find_internal_player(result.device_id)
    if not player:
        raise PlayerNotFoundError

    fingerprint = _fingerprint(result)
    requested_match_id = result.match_id
    if not requested_match_id:
        raise MatchValidationError
    if expire_stale_match(result.device_id):
        raise MatchExpiredError
    player = find_internal_player(result.device_id)
    if not player:
        raise PlayerNotFoundError
    active = player.get("active_match")
    if not active:
        previous = player.get("last_match_result") or {}
        if (
            previous.get("match_id") == requested_match_id
            and previous.get("fingerprint") == fingerprint
        ):
            return dict(previous["response"])
        lifecycle = player.get("last_match_lifecycle") or {}
        if (
            lifecycle.get("match_id") == requested_match_id
            and lifecycle.get("status") == "expired"
        ):
            raise MatchExpiredError
        if (
            lifecycle.get("match_id") == requested_match_id
            and lifecycle.get("status") == "rejected"
        ):
            raise MatchValidationError("invalid_match_state")
        raise MatchNotFoundError
    if active.get("id") != requested_match_id:
        raise MatchValidationError("ownership_mismatch")

    contest = get_contest(active.get("contest_id"))
    if not contest:
        _reject_match(result.device_id, active, "invalid_match_state", fingerprint)
    _, validation_outcome = _validate_result(active, result, _utc_now())
    won = result.score > result.opponent_score
    coin_reward = int(active["challenge_config"].get("prize_pool", 0)) if won else 10
    xp_reward = 50 if won else 15
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
        "accepted_score": result.score,
        "won": won,
        "validation_outcome": validation_outcome,
        "leveled_up": old_belt["key"] != new_belt["key"],
        "new_belt": new_belt,
    }
    update_pipeline = [
        {
            "$set": {
                "coins": response["new_coins"],
                "xp": response["new_xp"],
                "wins": {"$add": [{"$ifNull": ["$wins", 0]}, 1 if won else 0]},
                "losses": {"$add": [{"$ifNull": ["$losses", 0]}, 0 if won else 1]},
                "matches": {"$add": [{"$ifNull": ["$matches", 0]}, 1]},
                "best_score": response["new_best"],
                "antacid": response["new_tums"],
                "elo": {"$add": [{"$ifNull": ["$elo", 1000]}, 25 if won else -10]},
                "last_match_result": {
                    "match_id": active["id"],
                    "fingerprint": fingerprint,
                    "response": response,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "validation_outcome": validation_outcome,
                },
                "last_match_lifecycle": {
                    "match_id": active["id"],
                    "status": "settled",
                    "ended_at": _utc_now().isoformat(),
                },
                "active_match": "$$REMOVE",
            }
        }
    ]
    settled = settle_player_match(result.device_id, active["id"], update_pipeline)
    if settled:
        settled_response = dict(settled["last_match_result"]["response"])
        if COIN_DEBUG_LOGGING:
            logger.info(
                "Coin match reward player=%s reward=%s before=%s after=%s",
                result.device_id,
                coin_reward,
                player.get("coins"),
                settled_response.get("new_coins"),
            )
        return settled_response

    latest = find_internal_player(result.device_id) or {}
    previous = latest.get("last_match_result") or {}
    if (
        previous.get("match_id") == requested_match_id
        and previous.get("fingerprint") == fingerprint
    ):
        return dict(previous["response"])
    raise MatchNotFoundError
