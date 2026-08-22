import copy
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from pymongo.errors import DuplicateKeyError

from models import PvpAttemptResult
from services import pvp_service as pvp
from tests.test_match_anti_cheat import active_match, bite_events


def player(device="private-a", public="ffp_a", handle="alpha"):
    from services.social_service import DEFAULT_AVATAR
    return {"device_id": device, "public_id": public, "public_handle": handle, "public_handle_normalized": handle,
            "public_display_name": handle.title(), "public_avatar": dict(DEFAULT_AVATAR), "antacid": 2, "xp": 0,
            "level": 1, "wins": 0, "matches": 0, "best_score": 0, "equipped_gear": None}


def event_payloads():
    return [{"seq": event.seq, "t_ms": event.t_ms, "type": event.type, "source": event.source, "x": event.x, "y": event.y} for event in bite_events()]


def value_at(document, dotted):
    current = document
    for part in dotted.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def matches(document, query):
    if "$or" in query and not any(matches(document, item) for item in query["$or"]): return False
    for key, expected in query.items():
        if key.startswith("$"): continue
        actual = value_at(document, key)
        if isinstance(expected, dict):
            if "$exists" in expected and (actual is not None) != expected["$exists"]: return False
            if "$in" in expected and actual not in expected["$in"]: return False
            if "$all" in expected and (not isinstance(actual, list) or not all(value in actual for value in expected["$all"])): return False
            if "$nin" in expected and actual in expected["$nin"]: return False
            if "$ne" in expected and actual == expected["$ne"]: return False
            if "$gt" in expected and not (actual is not None and actual > expected["$gt"]): return False
        elif isinstance(actual, list):
            if expected not in actual: return False
        elif actual != expected: return False
    return True


def set_value(document, dotted, value):
    target = document
    parts = dotted.split(".")
    for part in parts[:-1]: target = target.setdefault(part, {})
    target[parts[-1]] = copy.deepcopy(value)


class MemoryCollection:
    def __init__(self): self.docs = []
    def find_one(self, query): return next((copy.deepcopy(item) for item in self.docs if matches(item, query)), None)
    def find(self, query): return [copy.deepcopy(item) for item in self.docs if matches(item, query)]
    def insert_one(self, document):
        if any(item.get("challenge_id") == document.get("challenge_id") or (document.get("status") == "PENDING" and item.get("status") == "PENDING" and item.get("pair_contest_key") == document.get("pair_contest_key")) for item in self.docs): raise DuplicateKeyError("duplicate")
        self.docs.append(copy.deepcopy(document))
    def update_one(self, query, update, upsert=False):
        for item in self.docs:
            if matches(item, query):
                for key, value in update.get("$set", {}).items(): set_value(item, key, value)
                return
        if upsert: self.docs.append(copy.deepcopy(update.get("$setOnInsert", {})))
    def find_one_and_update(self, query, update, return_document=None):
        for item in self.docs:
            if matches(item, query):
                for key, value in update.get("$set", {}).items(): set_value(item, key, value)
                return copy.deepcopy(item)
        return None


class PvpPhaseThreeTests(unittest.TestCase):
    def setUp(self):
        self.challenges = MemoryCollection(); self.matches = MemoryCollection()
        self.a = player(); self.b = player("private-b", "ffp_b", "beta"); self.c = player("private-c", "ffp_c", "gamma")
        self.players = {item["public_id"]: item for item in (self.a, self.b, self.c)}
        self.patches = [
            patch.object(pvp, "pvp_challenges", return_value=self.challenges), patch.object(pvp, "pvp_matches", return_value=self.matches),
            patch.object(pvp, "find_internal_player_by_public_id", side_effect=lambda pid: self.players.get(pid)),
            patch.object(pvp, "_is_friend", side_effect=lambda first, second: {first, second} == {"ffp_a", "ffp_b"}),
        ]
        for item in self.patches: item.start()
    def tearDown(self):
        for item in reversed(self.patches): item.stop()

    def test_only_friends_can_challenge_and_self_is_rejected(self):
        with self.assertRaisesRegex(pvp.PvpError, "CANNOT_CHALLENGE_SELF"): pvp.create_challenge(self.a, "ffp_a", "nathans-hotdogs")
        with self.assertRaisesRegex(pvp.PvpError, "FRIENDSHIP_REQUIRED"): pvp.create_challenge(self.a, "ffp_c", "nathans-hotdogs")
        created = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        self.assertEqual(created["status"], "PENDING"); self.assertNotIn("challenger_device_id", created)

    def test_duplicate_and_reciprocal_challenge_resolve_to_one_pending_record(self):
        first = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        second = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        reciprocal = pvp.create_challenge(self.b, "ffp_a", "nathans-hotdogs")
        self.assertEqual(first["challenge_id"], second["challenge_id"]); self.assertEqual(first["challenge_id"], reciprocal["challenge_id"])
        self.assertEqual(len(self.challenges.docs), 1)

    def test_accept_is_recipient_only_and_double_accept_creates_one_match(self):
        challenge = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        with self.assertRaises(pvp.PvpError): pvp.accept_challenge(self.a, challenge["challenge_id"])
        first = pvp.accept_challenge(self.b, challenge["challenge_id"])
        second = pvp.accept_challenge(self.b, challenge["challenge_id"])
        self.assertEqual(first["match_id"], second["match_id"]); self.assertEqual(len(self.matches.docs), 1)

    def test_accept_retry_repairs_an_interrupted_match_upsert(self):
        challenge = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        accepted = pvp.accept_challenge(self.b, challenge["challenge_id"])
        self.matches.docs.clear()
        repaired = pvp.accept_challenge(self.b, challenge["challenge_id"])
        self.assertEqual(repaired["match_id"], accepted["match_id"])
        self.assertEqual(len(self.matches.docs), 1)

    def test_decline_and_cancel_authorization(self):
        challenge = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        with self.assertRaises(pvp.PvpError): pvp.transition_challenge(self.c, challenge["challenge_id"], "DECLINED")
        declined = pvp.transition_challenge(self.b, challenge["challenge_id"], "DECLINED")
        self.assertEqual(declined["status"], "DECLINED")
        other = pvp.create_challenge(self.a, "ffp_b", "wing-bowl")
        with self.assertRaises(pvp.PvpError): pvp.transition_challenge(self.b, other["challenge_id"], "CANCELLED")
        self.assertEqual(pvp.transition_challenge(self.a, other["challenge_id"], "CANCELLED")["status"], "CANCELLED")

    def test_expired_challenge_cannot_accept(self):
        challenge = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        self.challenges.docs[0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        with self.assertRaisesRegex(pvp.PvpError, "CHALLENGE_EXPIRED"): pvp.accept_challenge(self.b, challenge["challenge_id"])

    def test_attempt_secret_is_server_only_and_public_id_does_not_authorize_other_attempt(self):
        challenge = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs"); match = pvp.accept_challenge(self.b, challenge["challenge_id"])
        started = pvp.start_attempt(self.a, match["match_id"])
        self.assertNotIn("match_seed", started); self.assertNotIn("device_id", started)
        with self.assertRaises(pvp.PvpError): pvp.start_attempt(self.c, match["match_id"])

    def test_expired_match_cannot_be_started_directly(self):
        challenge = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        match = pvp.accept_challenge(self.b, challenge["challenge_id"])
        self.matches.docs[0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        with self.assertRaisesRegex(pvp.PvpError, "PVP_MATCH_EXPIRED"):
            pvp.start_attempt(self.a, match["match_id"])

    def test_level25_replay_derives_score_and_preserves_suspicious_policy(self):
        active = active_match(); active["id"] = "pva_test"; active["device_id"] = "private-a"
        active["started_at"] = (datetime.now(timezone.utc) - timedelta(seconds=active["allowed_duration_sec"])).isoformat()
        active["expires_at"] = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
        replay = pvp.replay_input_log(active, bite_events())
        result = PvpAttemptResult(match_id="pvm_test", attempt_id="pva_test", contest_id=active["contest_id"], score=replay["replayed_score"], duration_sec=active["allowed_duration_sec"], accepted_taps=replay["accepted_taps"], completed_progress=replay["completed_progress"], maximum_combo=replay["maximum_combo"], tums_used=replay["antacids_used"], validation_version=2, input_events=event_payloads())
        validated = pvp._validate_attempt(active, result, datetime.now(timezone.utc), "private-a")
        self.assertEqual(validated["replayed_score"], replay["replayed_score"]); self.assertIn(validated["status"], {"VALID", "SUSPICIOUS"})

    def test_score_tampering_becomes_invalid_and_cannot_win(self):
        active = active_match(); active["id"] = "pva_test"; active["device_id"] = "private-a"
        active["started_at"] = (datetime.now(timezone.utc) - timedelta(seconds=active["allowed_duration_sec"])).isoformat(); active["expires_at"] = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
        replay = pvp.replay_input_log(active, bite_events())
        result = PvpAttemptResult(match_id="pvm_test", attempt_id="pva_test", contest_id=active["contest_id"], score=replay["replayed_score"] + 1000, duration_sec=active["allowed_duration_sec"], accepted_taps=replay["accepted_taps"], completed_progress=replay["completed_progress"], maximum_combo=replay["maximum_combo"], validation_version=2, input_events=event_payloads())
        with self.assertRaisesRegex(pvp.PvpError, "PVP_REPLAY_MISMATCH"): pvp._validate_attempt(active, result, datetime.now(timezone.utc), "private-a")

    def test_submit_is_owned_idempotent_and_invalid_evidence_cannot_score(self):
        now = datetime.now(timezone.utc)
        active = active_match(); active["id"] = "pva_test"; active["device_id"] = "private-a"
        active["started_at"] = (now - timedelta(seconds=active["allowed_duration_sec"])).isoformat()
        active["expires_at"] = (now + timedelta(minutes=2)).isoformat()
        replay = pvp.replay_input_log(active, bite_events())
        valid = PvpAttemptResult(match_id="pvm_test", attempt_id="pva_test", contest_id=active["contest_id"], score=replay["replayed_score"], duration_sec=active["allowed_duration_sec"], accepted_taps=replay["accepted_taps"], completed_progress=replay["completed_progress"], maximum_combo=replay["maximum_combo"], validation_version=2, input_events=event_payloads())
        document = pvp._new_match({"challenge_id": "pvc", "challenger_public_id": "ffp_a", "recipient_public_id": "ffp_b", "challenger_device_id": "private-a", "recipient_device_id": "private-b", "contest_id": active["contest_id"], "contest": {"id": active["contest_id"], "name": "Dogs"}}, "pvm_test", now)
        document.update({"status": "WAITING", "attempts": {"ffp_a": active, "ffp_b": {"status": "VALID", "official_score": 1}}})
        self.matches.docs.append(document)
        with patch.object(pvp, "_now", return_value=now):
            first = pvp.submit_attempt(self.a, valid)
            retry = pvp.submit_attempt(self.a, valid)
        self.assertEqual(first["status"], "FINAL")
        self.assertTrue(retry["already_finalized"])
        self.assertEqual(first["result"]["rewards"], {"coins": 0, "xp": 0})
        snapshot = copy.deepcopy(self.matches.docs[0])
        forged = valid.model_copy(update={"attempt_id": "pva_someone_else"})
        with self.assertRaisesRegex(pvp.PvpError, "PVP_ATTEMPT_MISMATCH"):
            pvp.submit_attempt(self.a, forged)
        self.assertEqual(self.matches.docs[0], snapshot)

        invalid_match = copy.deepcopy(document)
        invalid_match["match_id"] = "pvm_invalid"
        invalid_match["status"] = "WAITING"
        invalid_match["attempts"]["ffp_a"] = active
        invalid_match["attempts"]["ffp_b"] = {"status": "VALID", "official_score": 1}
        self.matches.docs.append(invalid_match)
        tampered = valid.model_copy(update={"match_id": "pvm_invalid", "score": replay["replayed_score"] + 1000})
        with patch.object(pvp, "_now", return_value=now):
            rejected = pvp.submit_attempt(self.a, tampered)
        self.assertEqual(rejected["status"], "FINAL")
        self.assertEqual(rejected["result"]["own_score"], 0)
        self.assertEqual(rejected["result"]["rewards"], {"coins": 0, "xp": 0})

    def test_perspective_results_are_consistent_and_have_zero_rewards_rating(self):
        self.matches.docs.append({"match_id": "pvm", "challenge_id": "pvc", "status": "WAITING", "participant_public_ids": ["ffp_a", "ffp_b"], "contest_id": "nathans-hotdogs", "contest": {"id": "nathans-hotdogs", "name": "Dogs"}, "expires_at": (datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(), "attempts": {"ffp_a": {"status": "VALID", "official_score": 620}, "ffp_b": {"status": "VALID", "official_score": 580}}})
        final = pvp._finalize("pvm")
        a = pvp.match_view(self.a, final); b = pvp.match_view(self.b, final)
        self.assertEqual((a["result"]["outcome"], b["result"]["outcome"]), ("WIN", "LOSS"))
        self.assertEqual(a["result"]["own_score"], b["result"]["opponent_score"]); self.assertEqual(a["result"]["rewards"], {"coins": 0, "xp": 0})

    def test_public_views_exclude_private_and_anticheat_fields(self):
        challenge = pvp.create_challenge(self.a, "ffp_b", "nathans-hotdogs")
        serialized = str(challenge)
        for secret in ("private-a", "private-b", "match_seed", "auth_token", "anti_cheat"): self.assertNotIn(secret, serialized)


if __name__ == "__main__": unittest.main()
