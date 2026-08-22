"""Server-authoritative AI match lifecycle and progression updates."""

import random
import secrets
import uuid
import logging
import os
import math
import time
import hashlib
import json
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
from services.match_validation import (
    BASE_PERK_MODIFIERS,
    GEAR_PERK_MODIFIERS,
    OPPONENT_SCORE_DIAGNOSTIC_TOLERANCE,
    authoritative_opponent_score,
    authoritative_perk_config,
    build_opponent_config,
    maximum_antacid_uses,
    maximum_combo_for_timing,
    maximum_heat_aware_progress,
    maximum_score_for_telemetry,
    maximum_taps_for_duration,
    minimum_progress_for_taps,
    progress_epsilon,
    trusted_heat_per_tap,
    replay_input_log,
    InputReplayError,
    VALIDATION_VERSION,
)


MATCH_RECOVERY_WINDOW_SECONDS = 15 * 60
MATCHMAKING_QUEUE_TTL_SECONDS = 2 * 60
MATCH_SUBMISSION_GRACE_SECONDS = 2 * 60
MATCH_START_CLOCK_TOLERANCE_SECONDS = 8
MATCH_DURATION_TOLERANCE_SECONDS = 8
MATCH_SCHEMA_VERSION = 4
logger = logging.getLogger(__name__)
COIN_DEBUG_LOGGING = os.environ.get("FIRE_FEAST_ENV", "development").lower() == "development"
MATCH_DIAGNOSTICS_ENABLED = os.environ.get("FIRE_FEAST_ENV", "development").lower() != "production"


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
            "server_time": _utc_now().isoformat(),
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
    match_seed = secrets.token_hex(32)
    opponent_seed = uuid.UUID(match_id).int & 0xFFFFFFFF
    started_at = _utc_now()
    allowed_duration = int(contest.get("duration_sec", 0))
    expires_at = started_at + timedelta(
        seconds=allowed_duration + MATCH_SUBMISSION_GRACE_SECONDS
    )
    equipped_gear, perk_modifiers = authoritative_perk_config(
        player.get("equipped_gear")
    )
    opponent_config = build_opponent_config(opponent, contest, opponent_seed)
    response = {
        "match_id": match_id,
        "contest": contest,
        "opponent": opponent,
        "opp_pace_per_sec": opponent_config["pace_per_sec"],
        "opponent_config": opponent_config,
        "player_tums": int(player.get("antacid", 0)),
        "player_coins": new_coins,
        "equipped_gear": equipped_gear,
        "perk_modifiers": perk_modifiers,
        "authoritative_duration_sec": allowed_duration,
        "server_started_at": started_at.isoformat(),
        "server_time": started_at.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    match = {
        "schema_version": MATCH_SCHEMA_VERSION,
        "validation_version": VALIDATION_VERSION,
        "match_seed": match_seed,
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
            "heat_per_tap": trusted_heat_per_tap(contest),
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
        "opponent_config": opponent_config,
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


def _result_payload(result) -> dict:
    input_events = [
        {
            "seq": event.seq,
            "t_ms": event.t_ms,
            "type": event.type,
        }
        for event in result.input_events
    ]
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
        "validation_version": result.validation_version,
        "input_events": input_events,
    }


def _fingerprint(result) -> dict:
    canonical = json.dumps(_result_payload(result), sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return {
        "version": 1,
        "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
    }


def _validation_telemetry(result) -> dict:
    telemetry = _result_payload(result)
    events = telemetry.pop("input_events")
    telemetry["input_event_count"] = len(events)
    return telemetry


def _reject_match(device_id: str, active: dict, reason: str, telemetry: dict) -> None:
    now = _utc_now().isoformat()
    transition_player_match(
        device_id,
        active.get("id"),
        "rejected",
        now,
        rejection_reason=reason,
    )
    safe_telemetry = {
        key: value for key, value in telemetry.items() if key != "input_events"
    }
    safe_telemetry.setdefault("input_event_count", len(telemetry.get("input_events", [])))
    logger.warning(
        "Match validation player=%s match=%s outcome=rejected reason=%s telemetry=%s",
        device_id,
        active.get("id"),
        reason,
        safe_telemetry,
    )
    raise MatchValidationError(reason)


def _plausibility_bounds(active: dict, result, server_elapsed: float) -> dict:
    duration = int(active["allowed_duration_sec"])
    perk = active.get("perk_modifiers")
    if not isinstance(perk, dict):
        _, perk = authoritative_perk_config(active.get("equipped_gear"))
    tap_power = float(perk.get("tap_power", 1))
    combo_window_ms = int(perk.get("combo_window_ms", 700))
    score_multiplier = float(perk.get("score_multiplier", 1))
    heat_generation_multiplier = float(
        perk.get("heat_generation_multiplier", 1)
    )
    challenge = active.get("challenge_config") or {}
    heat_per_tap = float(challenge.get("heat_per_tap", 0))
    maximum_taps = maximum_taps_for_duration(duration)
    maximum_combo = maximum_combo_for_timing(
        result.accepted_taps,
        duration,
        combo_window_ms,
    )
    maximum_progress = maximum_heat_aware_progress(
        result.accepted_taps,
        duration,
        result.tums_used,
        tap_power,
        heat_per_tap,
        heat_generation_multiplier,
    )
    minimum_progress = minimum_progress_for_taps(result.accepted_taps, tap_power)
    maximum_score = maximum_score_for_telemetry(
        accepted_taps=result.accepted_taps,
        completed_progress=result.completed_progress,
        maximum_combo=result.maximum_combo,
        duration_sec=duration,
        antacids_used=result.tums_used,
        tap_power=tap_power,
        score_multiplier=score_multiplier,
        heat_per_tap=heat_per_tap,
        heat_generation_multiplier=heat_generation_multiplier,
    )
    return {
        "maximum_taps": maximum_taps,
        "maximum_progress": maximum_progress,
        "minimum_progress": minimum_progress,
        "maximum_combo": maximum_combo,
        "maximum_score": maximum_score,
        "combo_window_ms": combo_window_ms,
        "heat_per_tap": heat_per_tap,
        "heat_generation_multiplier": heat_generation_multiplier,
        "server_elapsed": server_elapsed,
    }


def _validate_result(active: dict, result, now: datetime) -> tuple[dict, str]:
    telemetry = _validation_telemetry(result)
    if active.get("schema_version") != MATCH_SCHEMA_VERSION:
        _reject_match(result.device_id, active, "invalid_match_state", telemetry)
    if (
        active.get("validation_version") != VALIDATION_VERSION
        or result.validation_version != VALIDATION_VERSION
        or not isinstance(active.get("match_seed"), str)
        or len(active["match_seed"]) < 64
    ):
        _reject_match(result.device_id, active, "invalid_validation_context", telemetry)
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
        or result.tums_used > maximum_antacid_uses(allowed_duration)
    ):
        _reject_match(result.device_id, active, "invalid_inventory", telemetry)

    bounds = _plausibility_bounds(active, result, server_elapsed)
    if result.accepted_taps > bounds["maximum_taps"]:
        _reject_match(result.device_id, active, "impossible_taps", telemetry)
    if result.maximum_combo > bounds["maximum_combo"]:
        _reject_match(result.device_id, active, "impossible_combo", telemetry)
    trusted_tap_power = float(active["perk_modifiers"]["tap_power"])
    epsilon = progress_epsilon(result.accepted_taps)
    if result.accepted_taps == 0 and (
        result.completed_progress > 0
        or result.maximum_combo > 0
        or result.score > 0
    ):
        reason = "impossible_score" if result.score > 0 else "impossible_progress"
        _reject_match(result.device_id, active, reason, telemetry)
    if (
        result.completed_progress
        > result.accepted_taps * trusted_tap_power + epsilon
        or result.completed_progress > bounds["maximum_progress"] + epsilon
        or result.completed_progress + epsilon < bounds["minimum_progress"]
    ):
        _reject_match(result.device_id, active, "impossible_progress", telemetry)
    if result.score > bounds["maximum_score"]:
        _reject_match(result.device_id, active, "impossible_score", telemetry)
    opponent_score = authoritative_opponent_score(active)
    if opponent_score is None:
        _reject_match(result.device_id, active, "invalid_match_state", telemetry)
    if abs(result.opponent_score - opponent_score) > OPPONENT_SCORE_DIAGNOSTIC_TOLERANCE:
        _reject_match(
            result.device_id,
            active,
            "impossible_opponent_result",
            telemetry,
        )

    try:
        replay = replay_input_log(active, result.input_events)
    except InputReplayError as error:
        _reject_match(result.device_id, active, error.reason, telemetry)
    if replay["accepted_taps"] != result.accepted_taps:
        _reject_match(result.device_id, active, "input_count_mismatch", telemetry)
    if replay["antacids_used"] != result.tums_used:
        _reject_match(result.device_id, active, "antacid_count_mismatch", telemetry)
    if replay["maximum_combo"] != result.maximum_combo:
        _reject_match(result.device_id, active, "combo_replay_mismatch", telemetry)
    if abs(replay["completed_progress"] - result.completed_progress) > progress_epsilon(result.accepted_taps):
        _reject_match(result.device_id, active, "progress_replay_mismatch", telemetry)
    score_delta = result.score - replay["replayed_score"]
    score_tolerance = max(5, math.ceil(max(1, replay["replayed_score"]) * 0.02))
    if abs(score_delta) > score_tolerance:
        _reject_match(result.device_id, active, "score_replay_mismatch", telemetry)

    outcome = (
        "suspicious_but_accepted"
        if replay["status"] == "SUSPICIOUS" or score_delta != 0
        else "accepted"
    )
    replay["submitted_score"] = result.score
    replay["score_delta"] = score_delta
    bounds["replay"] = replay
    logger.info(
        "Match validation player=%s match=%s outcome=%s duration=%s "
        "submitted_score=%s replayed_score=%s score_delta=%s events=%s peak_rate=%s",
        result.device_id,
        active.get("id"),
        outcome,
        result.duration_sec,
        result.score,
        replay["replayed_score"],
        score_delta,
        replay["input_event_count"],
        replay["peak_input_rate"],
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
    previous = player.get("last_match_result") or {}
    if (
        previous.get("match_id") == requested_match_id
        and previous.get("fingerprint") == fingerprint
    ):
        logger.info(
            "Match validation match_id=%s player=%s outcome=already_settled",
            requested_match_id,
            result.device_id,
        )
        return {**dict(previous["response"]), "already_finalized": True}
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
            logger.info(
                "Match validation match_id=%s player=%s outcome=already_settled",
                requested_match_id,
                result.device_id,
            )
            return {**dict(previous["response"]), "already_finalized": True}
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
        _reject_match(result.device_id, active, "invalid_match_state", _validation_telemetry(result))
    validation_started = time.perf_counter()
    validation, validation_outcome = _validate_result(active, result, _utc_now())
    replay = validation["replay"]
    replay["validation_elapsed_ms"] = round((time.perf_counter() - validation_started) * 1000, 3)
    accepted_score = replay["replayed_score"]
    opponent_score = authoritative_opponent_score(active)
    if opponent_score is None:
        _reject_match(result.device_id, active, "invalid_match_state", _validation_telemetry(result))
    authoritative_outcome = (
        "win"
        if accepted_score > opponent_score
        else "tie" if accepted_score == opponent_score else "loss"
    )
    won = authoritative_outcome == "win"
    lost = authoritative_outcome == "loss"
    drawn = authoritative_outcome == "tie"
    coin_reward = int(active["challenge_config"].get("prize_pool", 0)) if won else 10
    xp_reward = 50 if won else 15
    old_xp = int(player.get("xp", 0))
    new_xp = old_xp + xp_reward
    old_belt = belt_for_xp(old_xp)
    new_belt = belt_for_xp(new_xp)
    contest_best_achieved_at = _utc_now().isoformat()
    response = {
        "verified": True,
        "match_id": active["id"],
        "already_finalized": False,
        "coin_reward": coin_reward,
        "xp_reward": xp_reward,
        "new_coins": {"$add": [{"$ifNull": ["$coins", 0]}, coin_reward]},
        "new_xp": {"$add": [{"$ifNull": ["$xp", 0]}, xp_reward]},
        "new_best": {"$max": [{"$ifNull": ["$best_score", 0]}, accepted_score]},
        "new_tums": {
            "$max": [0, {"$subtract": [{"$ifNull": ["$antacid", 0]}, replay["antacids_used"]]}]
        },
        "accepted_score": accepted_score,
        "authoritative_opponent_score": opponent_score,
        "authoritative_outcome": authoritative_outcome,
        "won": won,
        "leveled_up": old_belt["key"] != new_belt["key"],
        "new_belt": new_belt,
    }
    if MATCH_DIAGNOSTICS_ENABLED:
        response["validation_outcome"] = validation_outcome
        response["anti_cheat"] = replay
    update_pipeline = [
        {
            "$set": {
                "coins": response["new_coins"],
                "xp": response["new_xp"],
                "wins": {"$add": [{"$ifNull": ["$wins", 0]}, 1 if won else 0]},
                "losses": {"$add": [{"$ifNull": ["$losses", 0]}, 1 if lost else 0]},
                "draws": {"$add": [{"$ifNull": ["$draws", 0]}, 1 if drawn else 0]},
                "matches": {"$add": [{"$ifNull": ["$matches", 0]}, 1]},
                "best_score": response["new_best"],
                "contest_best_scores": {
                    "$let": {
                        "vars": {"bests": {"$ifNull": ["$contest_best_scores", []]}},
                        "in": {
                            "$cond": [
                                {"$anyElementTrue": {"$map": {"input": "$$bests", "as": "best", "in": {"$eq": ["$$best.contest_id", active["contest_id"]]}}}},
                                {"$map": {"input": "$$bests", "as": "best", "in": {
                                    "$cond": [
                                        {"$eq": ["$$best.contest_id", active["contest_id"]]},
                                        {"$cond": [
                                            {"$gt": [accepted_score, {"$ifNull": ["$$best.score", 0]}]},
                                            {"contest_id": active["contest_id"], "score": accepted_score, "achieved_at": contest_best_achieved_at},
                                            "$$best",
                                        ]},
                                        "$$best",
                                    ]
                                }}},
                                {"$concatArrays": ["$$bests", [{"contest_id": active["contest_id"], "score": accepted_score, "achieved_at": contest_best_achieved_at}]]},
                            ]
                        },
                    }
                },
                "antacid": response["new_tums"],
                "elo": {"$add": [{"$ifNull": ["$elo", 1000]}, 25 if won else -10]},
                "last_match_result": {
                    "match_id": active["id"],
                    "fingerprint": fingerprint,
                    "response": response,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "validation_outcome": validation_outcome,
                    "anti_cheat": replay,
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
        settled_response.setdefault("verified", True)
        settled_response.setdefault("match_id", requested_match_id)
        settled_response.setdefault("already_finalized", False)
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
        logger.info(
            "Match validation match_id=%s player=%s outcome=already_settled",
            requested_match_id,
            result.device_id,
        )
        return dict(previous["response"])
    raise MatchNotFoundError
