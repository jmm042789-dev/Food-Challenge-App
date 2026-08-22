"""Server-authoritative direct friend challenges and asynchronous PvP attempts."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import secrets
import uuid

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from data.contests import get_contest
from database import (
    find_internal_player,
    find_internal_player_by_public_id,
    pvp_challenges,
    pvp_matches,
    social_relationships,
)
from services.match_service import MATCH_SCHEMA_VERSION
from services.match_validation import (
    InputReplayError,
    VALIDATION_VERSION,
    authoritative_perk_config,
    maximum_antacid_uses,
    progress_epsilon,
    replay_input_log,
    trusted_heat_per_tap,
)
from services.social_service import ensure_public_identity, public_profile


CHALLENGE_TTL = timedelta(hours=24)
PVP_MATCH_TTL = timedelta(hours=48)
ATTEMPT_GRACE = timedelta(minutes=2)
PVP_COMPATIBLE_MECHANICS = {"tap", "bite", "rapid", "swipe", "slice", "hold_release"}
QUIP_COOLDOWNS = {"PRE_MATCH": 3, "IN_GAME": 5, "POST_MATCH": 3}
QUIP_LIMITS = {"PRE_MATCH": 3, "IN_GAME": 3, "POST_MATCH": 3}
APPROVED_QUIPS = {
    "PRE_MATCH": {"ready": "Ready to Feast?", "bring_heat": "Bring the Heat!", "good_luck": "Good luck!", "lets_eat": "Let's eat!"},
    "IN_GAME": {"catch_me": "Catch me if you can!", "on_fire": "I'm on fire!", "antacid": "Need an Antacid?", "chomp": "CHOMP CHOMP!", "too_hot": "Too hot to handle!"},
    "POST_MATCH": {"gg": "GG!", "nice_match": "Nice match!", "close": "That was close!", "you_got_me": "You got me!", "run_it_back": "Run it back!"},
}


class PvpError(Exception):
    def __init__(self, code: str, status_code: int = 400):
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(value: str | None) -> datetime | None:
    try:
        parsed = datetime.fromisoformat((value or "").replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else None
    except (TypeError, ValueError):
        return None


def _pair(first: str, second: str) -> str:
    return ":".join(sorted((first, second)))


def _contest(contest_id: str) -> dict:
    contest = get_contest(contest_id)
    mechanic = str((contest or {}).get("bite_mechanic", "tap")).lower()
    if not contest or mechanic not in PVP_COMPATIBLE_MECHANICS:
        raise PvpError("PVP_CONTEST_UNAVAILABLE", 404)
    return contest


def compatible_contests() -> list[dict]:
    from data.contests import CONTESTS
    return [
        {key: contest.get(key) for key in ("id", "name", "food", "difficulty", "duration_sec", "bite_mechanic")}
        for contest in CONTESTS
        if str(contest.get("bite_mechanic", "tap")).lower() in PVP_COMPATIBLE_MECHANICS
    ]


def _is_friend(first: str, second: str) -> bool:
    return bool(social_relationships().find_one({"pair_key": _pair(first, second), "status": "accepted"}))


def _expire_challenge(document: dict, now: datetime) -> dict:
    expires = _parse(document.get("expires_at"))
    if document.get("status") == "PENDING" and (expires is None or now >= expires):
        changed = pvp_challenges().find_one_and_update(
            {"challenge_id": document["challenge_id"], "status": "PENDING"},
            {"$set": {"status": "EXPIRED", "updated_at": now.isoformat()}},
            return_document=ReturnDocument.AFTER,
        )
        return changed or {**document, "status": "EXPIRED"}
    return document


def _profiles(ids: list[str]) -> dict[str, dict]:
    result = {}
    for public_id in ids:
        player = find_internal_player_by_public_id(public_id)
        if player:
            result[public_id] = public_profile(player, "FRIENDS")
    return result


def _challenge_view(document: dict, viewer_public_id: str) -> dict:
    profiles = _profiles([document["challenger_public_id"], document["recipient_public_id"]])
    other_id = document["recipient_public_id"] if viewer_public_id == document["challenger_public_id"] else document["challenger_public_id"]
    return {
        "challenge_id": document["challenge_id"], "status": document["status"],
        "contest": document["contest"], "created_at": document["created_at"],
        "expires_at": document["expires_at"], "match_id": document.get("match_id"), "rematch_of": document.get("rematch_of"),
        "direction": "OUTGOING" if viewer_public_id == document["challenger_public_id"] else "INCOMING",
        "player": profiles.get(other_id),
    }


def create_challenge(viewer: dict, recipient_public_id: str, contest_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    source = owner["public_id"]
    if source == recipient_public_id:
        raise PvpError("CANNOT_CHALLENGE_SELF")
    recipient = find_internal_player_by_public_id(recipient_public_id)
    if not recipient:
        raise PvpError("PLAYER_NOT_FOUND", 404)
    if not _is_friend(source, recipient_public_id):
        raise PvpError("FRIENDSHIP_REQUIRED", 403)
    contest = _contest(contest_id)
    now = _now()
    pair_contest = f"{_pair(source, recipient_public_id)}:{contest_id}"
    existing = pvp_challenges().find_one({"pair_contest_key": pair_contest, "status": "PENDING"})
    if existing:
        existing = _expire_challenge(existing, now)
        if existing["status"] == "PENDING":
            return _challenge_view(existing, source)
    document = {
        "challenge_id": f"pvc_{uuid.uuid4()}", "pair_contest_key": pair_contest,
        "challenger_public_id": source, "recipient_public_id": recipient_public_id,
        "challenger_device_id": owner["device_id"], "recipient_device_id": recipient["device_id"],
        "contest_id": contest_id,
        "contest": {key: contest.get(key) for key in ("id", "name", "food", "difficulty", "duration_sec", "bite_mechanic")},
        "status": "PENDING", "created_at": now.isoformat(), "updated_at": now.isoformat(),
        "expires_at": (now + CHALLENGE_TTL).isoformat(),
    }
    try:
        pvp_challenges().insert_one(document)
    except DuplicateKeyError:
        document = pvp_challenges().find_one({"pair_contest_key": pair_contest, "status": "PENDING"})
        if not document:
            raise PvpError("CHALLENGE_CONFLICT", 409)
    return _challenge_view(document, source)


def create_rematch(viewer: dict, match_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    original = pvp_matches().find_one({"match_id": match_id, "participant_public_ids": owner["public_id"], "status": "FINAL"})
    if not original:
        raise PvpError("FINAL_MATCH_NOT_FOUND", 404)
    opponent_id = next(item for item in original["participant_public_ids"] if item != owner["public_id"])
    challenge = create_challenge(owner, opponent_id, original["contest_id"])
    pvp_challenges().find_one_and_update(
        {"challenge_id": challenge["challenge_id"], "status": "PENDING"},
        {"$set": {"rematch_of": match_id}}, return_document=ReturnDocument.AFTER,
    )
    return {**challenge, "rematch_of": match_id}


def list_challenges(viewer: dict) -> dict:
    owner = ensure_public_identity(viewer)
    public_id = owner["public_id"]
    now = _now()
    docs = list(pvp_challenges().find({"$or": [{"challenger_public_id": public_id}, {"recipient_public_id": public_id}]}))
    views = [_challenge_view(_expire_challenge(item, now), public_id) for item in docs]
    return {
        "incoming": [item for item in views if item["direction"] == "INCOMING" and item["status"] == "PENDING"],
        "outgoing": [item for item in views if item["direction"] == "OUTGOING" and item["status"] == "PENDING"],
        "history": [item for item in views if item["status"] != "PENDING"][-20:],
    }


def _new_match(challenge: dict, match_id: str, now: datetime) -> dict:
    quip_state = {public_id: {"counts": {category: 0 for category in QUIP_LIMITS}, "last_sent_at": {category: "" for category in QUIP_LIMITS}, "last_quip_id": {category: "" for category in QUIP_LIMITS}, "processed_ids": []} for public_id in (challenge["challenger_public_id"], challenge["recipient_public_id"])}
    return {
        "match_id": match_id, "challenge_id": challenge["challenge_id"], "status": "READY",
        "participant_public_ids": [challenge["challenger_public_id"], challenge["recipient_public_id"]],
        "participant_device_ids": [challenge["challenger_device_id"], challenge["recipient_device_id"]],
        "contest_id": challenge["contest_id"], "contest": challenge["contest"],
        "validation_version": VALIDATION_VERSION, "created_at": now.isoformat(),
        "expires_at": (now + PVP_MATCH_TTL).isoformat(), "attempts": {}, "quip_state": quip_state, "quip_events": [],
    }


def accept_challenge(viewer: dict, challenge_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    now = _now()
    current = pvp_challenges().find_one({"challenge_id": challenge_id})
    if not current or current.get("recipient_public_id") != owner["public_id"]:
        raise PvpError("CHALLENGE_NOT_FOUND", 404)
    current = _expire_challenge(current, now)
    if current["status"] == "EXPIRED":
        raise PvpError("CHALLENGE_EXPIRED", 409)
    if current["status"] == "ACCEPTED" and current.get("match_id"):
        # Acceptance and match creation are recoverable without transactions:
        # the match id is deterministic and challenge_id is uniquely indexed.
        # If the process stopped between the two writes, this idempotent upsert
        # repairs the accepted challenge on the next authenticated retry.
        pvp_matches().update_one(
            {"challenge_id": challenge_id},
            {"$setOnInsert": _new_match(current, current["match_id"], now)},
            upsert=True,
        )
        match = pvp_matches().find_one({"match_id": current["match_id"]})
        if match:
            return match_view(owner, match)
    if current["status"] != "PENDING":
        raise PvpError("CHALLENGE_NOT_PENDING", 409)
    if not _is_friend(current["challenger_public_id"], current["recipient_public_id"]):
        raise PvpError("FRIENDSHIP_REQUIRED", 403)
    match_id = f"pvm_{uuid.uuid5(uuid.NAMESPACE_URL, 'fire-feast:' + challenge_id)}"
    accepted = pvp_challenges().find_one_and_update(
        {"challenge_id": challenge_id, "status": "PENDING", "recipient_public_id": owner["public_id"], "expires_at": {"$gt": now.isoformat()}},
        {"$set": {"status": "ACCEPTED", "match_id": match_id, "updated_at": now.isoformat()}},
        return_document=ReturnDocument.AFTER,
    )
    if not accepted:
        accepted = pvp_challenges().find_one({"challenge_id": challenge_id, "status": "ACCEPTED", "match_id": match_id})
        if not accepted:
            raise PvpError("CHALLENGE_CONFLICT", 409)
    pvp_matches().update_one({"challenge_id": challenge_id}, {"$setOnInsert": _new_match(accepted, match_id, now)}, upsert=True)
    match = pvp_matches().find_one({"challenge_id": challenge_id})
    return match_view(owner, match)


def transition_challenge(viewer: dict, challenge_id: str, action: str) -> dict:
    owner = ensure_public_identity(viewer)
    role_field = "recipient_public_id" if action == "DECLINED" else "challenger_public_id"
    changed = pvp_challenges().find_one_and_update(
        {"challenge_id": challenge_id, "status": "PENDING", role_field: owner["public_id"]},
        {"$set": {"status": action, "updated_at": _now().isoformat()}},
        return_document=ReturnDocument.AFTER,
    )
    if not changed:
        raise PvpError("CHALLENGE_NOT_PENDING", 409)
    return _challenge_view(changed, owner["public_id"])


def _attempt_context(player: dict, match: dict, now: datetime) -> dict:
    contest = _contest(match["contest_id"])
    duration = int(contest["duration_sec"])
    equipped, modifiers = authoritative_perk_config(player.get("equipped_gear"))
    attempt_id = f"pva_{uuid.uuid4()}"
    return {
        "schema_version": MATCH_SCHEMA_VERSION, "validation_version": VALIDATION_VERSION,
        "match_seed": secrets.token_hex(32), "id": attempt_id, "device_id": player["device_id"],
        "contest_id": contest["id"], "status": "active", "started_at": now.isoformat(),
        "allowed_duration_sec": duration, "expires_at": (now + timedelta(seconds=duration) + ATTEMPT_GRACE).isoformat(),
        "challenge_config": {"contest_id": contest["id"], "duration_sec": duration, "difficulty": contest.get("difficulty"), "bite_mechanic": contest.get("bite_mechanic"), "heartburn_per_bite": contest.get("heartburn_per_bite", 0), "heat_per_tap": trusted_heat_per_tap(contest), "prize_pool": 0},
        "equipped_gear": equipped, "perk_modifiers": modifiers, "starting_antacid": int(player.get("antacid", 0)),
    }


def start_attempt(viewer: dict, match_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    match = pvp_matches().find_one({"match_id": match_id, "participant_public_ids": owner["public_id"]})
    if not match:
        raise PvpError("PVP_MATCH_NOT_FOUND", 404)
    match_expires = _parse(match.get("expires_at"))
    if not match_expires or _now() >= match_expires:
        _expire_match(match)
        raise PvpError("PVP_MATCH_EXPIRED", 409)
    if match.get("status") in {"FINAL", "CANCELLED"}:
        return match_view(owner, match)
    existing = (match.get("attempts") or {}).get(owner["public_id"])
    if existing:
        return _attempt_start_view(owner, match, existing)
    if owner.get("active_match"):
        raise PvpError("ANOTHER_MATCH_ACTIVE", 409)
    other = pvp_matches().find_one({"match_id": {"$ne": match_id}, "participant_public_ids": owner["public_id"], "status": {"$in": ["ACTIVE", "WAITING"]}, f"attempts.{owner['public_id']}.status": "active"})
    if other:
        raise PvpError("ANOTHER_PVP_ATTEMPT_ACTIVE", 409)
    now = _now()
    attempt = _attempt_context(owner, match, now)
    updated = pvp_matches().find_one_and_update(
        {"match_id": match_id, f"attempts.{owner['public_id']}": {"$exists": False}},
        {"$set": {f"attempts.{owner['public_id']}": attempt, "status": "ACTIVE"}},
        return_document=ReturnDocument.AFTER,
    ) or pvp_matches().find_one({"match_id": match_id})
    return _attempt_start_view(owner, updated, updated["attempts"][owner["public_id"]])


def _attempt_start_view(owner: dict, match: dict, attempt: dict) -> dict:
    opponent_id = next(item for item in match["participant_public_ids"] if item != owner["public_id"])
    return {
        "match_id": match["match_id"], "attempt_id": attempt["id"], "contest": _contest(match["contest_id"]),
        "validation_version": VALIDATION_VERSION, "authoritative_duration_sec": attempt["allowed_duration_sec"],
        "server_started_at": attempt["started_at"], "server_time": _now().isoformat(), "expires_at": attempt["expires_at"],
        "player_tums": attempt["starting_antacid"], "equipped_gear": attempt["equipped_gear"], "perk_modifiers": attempt["perk_modifiers"],
        "opponent": public_profile(find_internal_player_by_public_id(opponent_id), "FRIENDS"),
    }


def _payload(result) -> dict:
    return result.model_dump(mode="json")


def _fingerprint(result) -> str:
    return hashlib.sha256(json.dumps(_payload(result), sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _validate_attempt(active: dict, result, now: datetime, device_id: str) -> dict:
    if active.get("id") != result.attempt_id or active.get("device_id") != device_id or active.get("contest_id") != result.contest_id:
        raise PvpError("PVP_ATTEMPT_MISMATCH", 403)
    if active.get("validation_version") != VALIDATION_VERSION or result.validation_version != VALIDATION_VERSION:
        raise PvpError("PVP_VALIDATION_CONTEXT_INVALID")
    started = _parse(active.get("started_at")); expires = _parse(active.get("expires_at")); duration = active.get("allowed_duration_sec")
    if not started or not expires or now >= expires or not isinstance(duration, int):
        raise PvpError("PVP_ATTEMPT_EXPIRED", 409)
    elapsed = (now - started).total_seconds()
    if result.duration_sec < duration - 8 or result.duration_sec > duration + 8 or elapsed < duration - 8:
        raise PvpError("PVP_TIMING_INVALID")
    if result.tums_used > active["starting_antacid"] or result.tums_used > maximum_antacid_uses(duration):
        raise PvpError("PVP_INVENTORY_INVALID")
    try:
        replay = replay_input_log(active, result.input_events)
    except InputReplayError as error:
        raise PvpError("PVP_ATTEMPT_INVALID") from error
    if replay["accepted_taps"] != result.accepted_taps or replay["antacids_used"] != result.tums_used or replay["maximum_combo"] != result.maximum_combo:
        raise PvpError("PVP_REPLAY_MISMATCH")
    if abs(replay["completed_progress"] - result.completed_progress) > progress_epsilon(result.accepted_taps):
        raise PvpError("PVP_REPLAY_MISMATCH")
    tolerance = max(5, math.ceil(max(1, replay["replayed_score"]) * .02))
    if abs(result.score - replay["replayed_score"]) > tolerance:
        raise PvpError("PVP_REPLAY_MISMATCH")
    replay["submitted_score"] = result.score
    replay["score_delta"] = result.score - replay["replayed_score"]
    return replay


def _finalize(match_id: str) -> dict:
    match = pvp_matches().find_one({"match_id": match_id})
    attempts = match.get("attempts") or {}
    if len(attempts) < 2 or any(item.get("status") not in {"VALID", "INVALID"} for item in attempts.values()):
        return match
    ids = match["participant_public_ids"]
    scores = {pid: attempts[pid].get("official_score", 0) for pid in ids}
    valid = {pid: attempts[pid]["status"] == "VALID" for pid in ids}
    if valid[ids[0]] != valid[ids[1]]:
        winner = ids[0] if valid[ids[0]] else ids[1]
    elif scores[ids[0]] == scores[ids[1]]:
        winner = None
    else:
        winner = max(ids, key=lambda pid: scores[pid])
    finalized = pvp_matches().find_one_and_update(
        {"match_id": match_id, "status": {"$ne": "FINAL"}},
        {"$set": {"status": "FINAL", "official_scores": scores, "winner_public_id": winner, "finalized_at": _now().isoformat(), "rewards": {"coins": 0, "xp": 0}, "rating_change": 0}},
        return_document=ReturnDocument.AFTER,
    )
    return finalized or pvp_matches().find_one({"match_id": match_id})


def rivalry_record(viewer: dict, opponent_public_id: str) -> dict:
    owner = ensure_public_identity(viewer); own_id = owner["public_id"]
    opponent = find_internal_player_by_public_id(opponent_public_id)
    if not opponent:
        raise PvpError("PLAYER_NOT_FOUND", 404)
    docs = list(pvp_matches().find({"status": "FINAL", "participant_public_ids": {"$all": [own_id, opponent_public_id]}}))
    wins = sum(item.get("winner_public_id") == own_id for item in docs)
    losses = sum(item.get("winner_public_id") == opponent_public_id for item in docs)
    draws = len(docs) - wins - losses
    return {"opponent": public_profile(opponent, "FRIENDS" if _is_friend(own_id, opponent_public_id) else "NONE"), "matches": len(docs), "wins": wins, "losses": losses, "draws": draws}


def recent_opponents(viewer: dict, limit: int = 12) -> dict:
    owner = ensure_public_identity(viewer); own_id = owner["public_id"]
    docs = list(pvp_matches().find({"status": "FINAL", "participant_public_ids": own_id}))
    docs.sort(key=lambda item: item.get("finalized_at", ""), reverse=True)
    seen = set(); result = []
    for item in docs:
        opponent_id = next((value for value in item["participant_public_ids"] if value != own_id), None)
        if not opponent_id or opponent_id in seen: continue
        opponent = find_internal_player_by_public_id(opponent_id)
        if not opponent: continue
        seen.add(opponent_id); winner = item.get("winner_public_id")
        result.append({"player": public_profile(opponent, "FRIENDS" if _is_friend(own_id, opponent_id) else "NONE"), "last_result": "DRAW" if winner is None else "WIN" if winner == own_id else "LOSS", "last_played_at": item.get("finalized_at"), "rivalry": rivalry_record(owner, opponent_id) | {"opponent": None}})
        if len(result) >= max(1, min(limit, 20)): break
    for item in result: item["rivalry"].pop("opponent", None)
    return {"opponents": result}


def send_quip(viewer: dict, data) -> dict:
    owner = ensure_public_identity(viewer); public_id = owner["public_id"]
    match = pvp_matches().find_one({"match_id": data.match_id, "participant_public_ids": public_id})
    if not match: raise PvpError("PVP_MATCH_NOT_FOUND", 404)
    approved = APPROVED_QUIPS.get(data.category, {})
    if data.quip_id not in approved: raise PvpError("QUIP_NOT_APPROVED")
    expected = "POST_MATCH" if match.get("status") == "FINAL" else "PRE_MATCH" if match.get("status") == "READY" and not (match.get("attempts") or {}) else "IN_GAME"
    if data.category != expected: raise PvpError("QUIP_WRONG_PHASE", 409)
    state = (match.get("quip_state") or {}).get(public_id, {})
    if data.client_event_id in state.get("processed_ids", []):
        event = next((item for item in match.get("quip_events", []) if item.get("client_event_id") == data.client_event_id and item.get("sender_public_id") == public_id), None)
        if event: return event
    if int((state.get("counts") or {}).get(data.category, 0)) >= QUIP_LIMITS[data.category]: raise PvpError("QUIP_LIMIT_REACHED", 429)
    if (state.get("last_quip_id") or {}).get(data.category) == data.quip_id: raise PvpError("QUIP_DUPLICATE", 409)
    now = _now(); last = _parse((state.get("last_sent_at") or {}).get(data.category))
    if last and (now - last).total_seconds() < QUIP_COOLDOWNS[data.category]: raise PvpError("QUIP_COOLDOWN", 429)
    event = {"event_id": "pvq_" + hashlib.sha256(f"{data.match_id}:{public_id}:{data.client_event_id}".encode()).hexdigest()[:24], "client_event_id": data.client_event_id, "sender_public_id": public_id, "quip_id": data.quip_id, "category": data.category, "text": approved[data.quip_id], "created_at": now.isoformat()}
    next_state = {**state, "counts": {**state.get("counts", {}), data.category: int((state.get("counts") or {}).get(data.category, 0)) + 1}, "last_sent_at": {**state.get("last_sent_at", {}), data.category: now.isoformat()}, "last_quip_id": {**state.get("last_quip_id", {}), data.category: data.quip_id}, "processed_ids": [*state.get("processed_ids", []), data.client_event_id][-12:]}
    updated = pvp_matches().find_one_and_update({"match_id": data.match_id, f"quip_state.{public_id}.processed_ids": {"$ne": data.client_event_id}, f"quip_state.{public_id}.counts.{data.category}": int((state.get("counts") or {}).get(data.category, 0)), f"quip_state.{public_id}.last_sent_at.{data.category}": (state.get("last_sent_at") or {}).get(data.category, ""), f"quip_state.{public_id}.last_quip_id.{data.category}": (state.get("last_quip_id") or {}).get(data.category, "")}, {"$set": {f"quip_state.{public_id}": next_state, "quip_events": [*match.get("quip_events", []), event][-12:]}}, return_document=ReturnDocument.AFTER)
    if not updated:
        current = pvp_matches().find_one({"match_id": data.match_id})
        existing = next((item for item in current.get("quip_events", []) if item.get("client_event_id") == data.client_event_id and item.get("sender_public_id") == public_id), None)
        if existing: return existing
        raise PvpError("QUIP_CONFLICT", 409)
    return event


def submit_attempt(viewer: dict, result) -> dict:
    owner = ensure_public_identity(viewer)
    match = pvp_matches().find_one({"match_id": result.match_id, "participant_public_ids": owner["public_id"]})
    if not match:
        raise PvpError("PVP_MATCH_NOT_FOUND", 404)
    attempt = (match.get("attempts") or {}).get(owner["public_id"])
    if not attempt:
        raise PvpError("PVP_ATTEMPT_NOT_STARTED", 409)
    # Identity fields are authorization boundaries, not anti-cheat outcomes. A
    # forged attempt/contest must not consume the authenticated player's one
    # attempt or turn it into a forfeit.
    if result.attempt_id != attempt.get("id") or result.contest_id != attempt.get("contest_id"):
        raise PvpError("PVP_ATTEMPT_MISMATCH", 403)
    fingerprint = _fingerprint(result)
    if attempt.get("status") in {"VALID", "INVALID"}:
        if attempt.get("fingerprint") != fingerprint:
            raise PvpError("PVP_RETRY_PAYLOAD_CHANGED", 409)
        return match_view(owner, _finalize(match["match_id"]), already_finalized=True)
    try:
        replay = _validate_attempt(attempt, result, _now(), owner["device_id"])
        terminal = {"status": "VALID", "official_score": replay["replayed_score"], "fingerprint": fingerprint, "submitted_at": _now().isoformat(), "anti_cheat": replay}
    except PvpError as error:
        terminal = {"status": "INVALID", "official_score": 0, "fingerprint": fingerprint, "submitted_at": _now().isoformat(), "anti_cheat": {"status": "INVALID", "reason_codes": [error.code], "validation_version": VALIDATION_VERSION}}
    updated = pvp_matches().find_one_and_update(
        {"match_id": result.match_id, f"attempts.{owner['public_id']}.status": "active"},
        {"$set": {f"attempts.{owner['public_id']}": {**attempt, **terminal}, "status": "WAITING"}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        current = pvp_matches().find_one({"match_id": result.match_id})
        current_attempt = (current.get("attempts") or {}).get(owner["public_id"], {})
        if current_attempt.get("fingerprint") != fingerprint:
            raise PvpError("PVP_RETRY_PAYLOAD_CHANGED", 409)
        updated = current
    return match_view(owner, _finalize(result.match_id))


def _expire_match(match: dict) -> dict:
    if match.get("status") in {"FINAL", "CANCELLED"}:
        return match
    now = _now(); attempts = match.get("attempts") or {}; changes = {}
    for public_id in match["participant_public_ids"]:
        attempt = attempts.get(public_id)
        deadline = _parse(attempt.get("expires_at")) if attempt else _parse(match.get("expires_at"))
        if deadline and now >= deadline and (not attempt or attempt.get("status") == "active"):
            base = attempt or {"id": None, "device_id": None}
            changes[f"attempts.{public_id}"] = {**base, "status": "INVALID", "official_score": 0, "terminal_reason": "TIMEOUT"}
    if changes:
        changes["status"] = "WAITING"
        match = pvp_matches().find_one_and_update({"match_id": match["match_id"], "status": {"$nin": ["FINAL", "CANCELLED"]}}, {"$set": changes}, return_document=ReturnDocument.AFTER) or match
    return _finalize(match["match_id"])


def match_view(viewer: dict, match: dict, already_finalized: bool = False) -> dict:
    owner = ensure_public_identity(viewer); public_id = owner["public_id"]
    if public_id not in match["participant_public_ids"]:
        raise PvpError("PVP_MATCH_NOT_FOUND", 404)
    opponent_id = next(item for item in match["participant_public_ids"] if item != public_id)
    attempt = (match.get("attempts") or {}).get(public_id)
    opponent_attempt = (match.get("attempts") or {}).get(opponent_id)
    own_quip_state = (match.get("quip_state") or {}).get(public_id, {})
    response = {
        "match_id": match["match_id"], "status": match["status"], "contest": match["contest"],
        "player": public_profile(owner, "SELF"),
        "opponent": public_profile(find_internal_player_by_public_id(opponent_id), "FRIENDS"),
        "own_attempt_state": attempt.get("status") if attempt else "NOT_STARTED",
        "opponent_submitted": bool(opponent_attempt and opponent_attempt.get("status") in {"VALID", "INVALID"}),
        "expires_at": match["expires_at"], "already_finalized": already_finalized,
        "quip_events": [{key: item.get(key) for key in ("event_id", "sender_public_id", "quip_id", "category", "text", "created_at")} for item in match.get("quip_events", [])],
        "quip_counts": own_quip_state.get("counts", {category: 0 for category in QUIP_LIMITS}),
        "approved_quips": APPROVED_QUIPS,
    }
    if match["status"] == "FINAL":
        scores = match["official_scores"]
        winner = match.get("winner_public_id")
        response["result"] = {
            "own_score": scores[public_id], "opponent_score": scores[opponent_id],
            "outcome": "DRAW" if winner is None else "WIN" if winner == public_id else "LOSS",
            "rewards": match.get("rewards", {"coins": 0, "xp": 0}), "rating_change": 0,
            "rivalry": rivalry_record(owner, opponent_id),
        }
        pending = pvp_challenges().find_one({"rematch_of": match["match_id"], "status": "PENDING"})
        response["rematch"] = _challenge_view(pending, public_id) if pending else None
    return response


def get_match(viewer: dict, match_id: str) -> dict:
    owner = ensure_public_identity(viewer)
    match = pvp_matches().find_one({"match_id": match_id, "participant_public_ids": owner["public_id"]})
    if not match:
        raise PvpError("PVP_MATCH_NOT_FOUND", 404)
    return match_view(owner, _expire_match(match))


def active_match(viewer: dict) -> dict:
    owner = ensure_public_identity(viewer)
    match = pvp_matches().find_one({"participant_public_ids": owner["public_id"], "status": {"$in": ["READY", "ACTIVE", "WAITING"]}})
    return {"status": "absent"} if not match else get_match(owner, match["match_id"])
