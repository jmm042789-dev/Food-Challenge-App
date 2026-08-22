import copy
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from services import pvp_service as pvp
from tests.test_pvp_phase3 import MemoryCollection, player


class PvpStepFourTests(unittest.TestCase):
    def setUp(self):
        self.challenges = MemoryCollection(); self.matches = MemoryCollection()
        self.a = player(); self.b = player("private-b", "ffp_b", "beta"); self.c = player("private-c", "ffp_c", "gamma")
        self.players = {item["public_id"]: item for item in (self.a, self.b, self.c)}
        self.friends = True
        self.patches = [patch.object(pvp, "pvp_challenges", return_value=self.challenges), patch.object(pvp, "pvp_matches", return_value=self.matches), patch.object(pvp, "find_internal_player_by_public_id", side_effect=lambda pid: self.players.get(pid)), patch.object(pvp, "_is_friend", side_effect=lambda *_: self.friends)]
        for item in self.patches: item.start()

    def tearDown(self):
        for item in reversed(self.patches): item.stop()

    def final_match(self, match_id="old", winner="ffp_a", when="2026-01-01T00:00:00+00:00"):
        challenge = {"challenge_id": "challenge_" + match_id, "challenger_public_id": "ffp_a", "recipient_public_id": "ffp_b", "challenger_device_id": "private-a", "recipient_device_id": "private-b", "contest_id": "nathans-hotdogs", "contest": {"id": "nathans-hotdogs", "name": "Hot Dogs", "food": "Hot Dogs", "duration_sec": 60, "bite_mechanic": "tap"}}
        document = pvp._new_match(challenge, match_id, datetime.now(timezone.utc)); document.update({"status": "FINAL", "winner_public_id": winner, "official_scores": {"ffp_a": 100, "ffp_b": 90}, "finalized_at": when, "rewards": {"coins": 0, "xp": 0}})
        self.matches.docs.append(document); return document

    def test_rematch_is_new_duplicate_safe_and_old_result_immutable(self):
        original = self.final_match(); snapshot = copy.deepcopy(original)
        first = pvp.create_rematch(self.a, "old"); second = pvp.create_rematch(self.a, "old"); reciprocal = pvp.create_rematch(self.b, "old")
        self.assertEqual(first["challenge_id"], second["challenge_id"]); self.assertEqual(first["challenge_id"], reciprocal["challenge_id"])
        self.assertEqual(self.matches.docs[0], snapshot)
        accepted = pvp.accept_challenge(self.b, first["challenge_id"])
        self.assertNotEqual(accepted["match_id"], "old")
        a = pvp.start_attempt(self.a, accepted["match_id"]); b = pvp.start_attempt(self.b, accepted["match_id"])
        self.assertNotEqual(a["attempt_id"], b["attempt_id"]); self.assertNotIn("match_seed", str((a, b)))

    def test_rivalry_reverses_perspective_and_recent_is_unique_ordered_safe(self):
        self.final_match("one", "ffp_a", "2026-01-01T00:00:00+00:00"); self.final_match("two", "ffp_b", "2026-01-03T00:00:00+00:00"); self.final_match("three", None, "2026-01-02T00:00:00+00:00")
        own = pvp.rivalry_record(self.a, "ffp_b"); other = pvp.rivalry_record(self.b, "ffp_a")
        self.assertEqual((own["wins"], own["losses"], own["draws"]), (1, 1, 1)); self.assertEqual(other["wins"], own["losses"])
        recent = pvp.recent_opponents(self.a)["opponents"]
        self.assertEqual(len(recent), 1); self.assertEqual(recent[0]["last_result"], "LOSS")
        for private in ("device_id", "match_seed", "anti_cheat", "auth_token"): self.assertNotIn(private, str(recent))

    def test_quips_are_approved_phase_bound_authorized_idempotent_and_bounded(self):
        match = self.final_match(); match["status"] = "READY"; match.pop("winner_public_id"); match.pop("official_scores")
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with patch.object(pvp, "_now", return_value=now):
            event = pvp.send_quip(self.a, SimpleNamespace(match_id="old", quip_id="ready", category="PRE_MATCH", client_event_id="evt1"))
            retry = pvp.send_quip(self.a, SimpleNamespace(match_id="old", quip_id="ready", category="PRE_MATCH", client_event_id="evt1"))
            self.assertEqual(event["event_id"], retry["event_id"])
            with self.assertRaisesRegex(pvp.PvpError, "QUIP_DUPLICATE"): pvp.send_quip(self.a, SimpleNamespace(match_id="old", quip_id="ready", category="PRE_MATCH", client_event_id="evt2"))
            with self.assertRaisesRegex(pvp.PvpError, "QUIP_NOT_APPROVED"): pvp.send_quip(self.a, SimpleNamespace(match_id="old", quip_id="hacked text", category="PRE_MATCH", client_event_id="evt3"))
            with self.assertRaisesRegex(pvp.PvpError, "QUIP_WRONG_PHASE"): pvp.send_quip(self.a, SimpleNamespace(match_id="old", quip_id="gg", category="POST_MATCH", client_event_id="evt4"))
            with self.assertRaises(pvp.PvpError): pvp.send_quip(self.c, SimpleNamespace(match_id="old", quip_id="ready", category="PRE_MATCH", client_event_id="evt5"))

    def test_exactly_three_ingame_quips_and_cooldown(self):
        match = self.final_match(); match["status"] = "ACTIVE"; match.pop("winner_public_id"); match.pop("official_scores"); match["attempts"] = {"ffp_a": {"status": "active"}}
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        for index, quip in enumerate(("catch_me", "on_fire", "chomp")):
            with patch.object(pvp, "_now", return_value=base + timedelta(seconds=index * 6)): pvp.send_quip(self.a, SimpleNamespace(match_id="old", quip_id=quip, category="IN_GAME", client_event_id=f"event{index}"))
        with patch.object(pvp, "_now", return_value=base + timedelta(seconds=20)):
            with self.assertRaisesRegex(pvp.PvpError, "QUIP_LIMIT_REACHED"): pvp.send_quip(self.a, SimpleNamespace(match_id="old", quip_id="too_hot", category="IN_GAME", client_event_id="event4"))
        self.assertEqual(self.matches.docs[0]["quip_state"]["ffp_a"]["counts"]["IN_GAME"], 3)


if __name__ == "__main__": unittest.main()
