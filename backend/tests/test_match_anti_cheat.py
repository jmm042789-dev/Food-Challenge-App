"""Level 2.5 deterministic input validation tests."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services import match_service
from services.match_validation import InputReplayError, replay_input_log

NOW = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)


def active_match():
    return {
        "schema_version": match_service.MATCH_SCHEMA_VERSION,
        "validation_version": 2,
        "match_seed": "a" * 64,
        "id": "match-a",
        "device_id": "player-a",
        "contest_id": "nathans",
        "opponent_id": "opponent-a",
        "status": "active",
        "started_at": (NOW - timedelta(seconds=60)).isoformat(),
        "allowed_duration_sec": 60,
        "expires_at": (NOW + timedelta(seconds=120)).isoformat(),
        "starting_antacid": 3,
        "equipped_gear": None,
        "perk_modifiers": dict(match_service.BASE_PERK_MODIFIERS),
        "challenge_config": {
            "contest_id": "nathans",
            "duration_sec": 60,
            "difficulty": "easy",
            "bite_mechanic": "tap",
            "heat_per_tap": 5,
            "prize_pool": 500,
        },
        "opponent_config": {
            "seed": 123,
            "final_score": 50,
            "pace_per_sec": 50 / 60,
            "duration_sec": 60,
            "opponent": {"id": "opponent-a"},
        },
        "start_response": {"match_id": "match-a"},
    }


def bite_events(count=60, spacing=600):
    timestamp = 0
    events = []
    for index in range(count):
        if index and index % 10 == 0:
            timestamp += 2_500
        timestamp += spacing
        events.append(SimpleNamespace(seq=index + 1, t_ms=timestamp, type="BITE", source="CONTROL", x=0.5, y=0.5))
    return events


def valid_result(active=None, events=None, **overrides):
    active = active or active_match()
    events = events if events is not None else bite_events()
    replay = replay_input_log(active, events)
    values = {
        "device_id": "player-a",
        "match_id": "match-a",
        "contest_id": "nathans",
        "opponent_id": "opponent-a",
        "score": replay["replayed_score"],
        "opponent_score": 50,
        "duration_sec": 60,
        "accepted_taps": replay["accepted_taps"],
        "completed_progress": replay["completed_progress"],
        "maximum_combo": replay["maximum_combo"],
        "tums_used": replay["antacids_used"],
        "completion_reason": "timer_completed",
        "is_tournament": False,
        "validation_version": 2,
        "input_events": events,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class MatchAntiCheatTests(unittest.TestCase):
    def test_burnout_rejects_logged_actions_and_resumes_at_exact_boundary(self):
        events = [
            {"seq": index + 1, "t_ms": (index + 1) * 100, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}
            for index in range(20)
        ]
        # Threshold is reached at 2000ms, warning ends at 4000ms, and burnout
        # lasts through 5499ms. A compliant client does not log that input.
        with self.assertRaises(InputReplayError) as raised:
            replay_input_log(active_match(), events + [{"seq": 21, "t_ms": 4000, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}])
        self.assertEqual(raised.exception.reason, "action_during_burnout")
        replay = replay_input_log(active_match(), events + [{"seq": 21, "t_ms": 5500, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}])
        self.assertEqual(replay["accepted_taps"], 21)
        self.assertEqual(replay["maximum_combo"], 19)
        self.assertEqual(replay["peak_heat"], 100.0)
        self.assertEqual(replay["final_heat"], 0.0)

    def test_antacid_can_save_warning_but_cannot_be_forged_during_burnout(self):
        threshold_events = [
            {"seq": index + 1, "t_ms": (index + 1) * 100, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}
            for index in range(20)
        ]
        saved = replay_input_log(active_match(), threshold_events + [{"seq": 21, "t_ms": 3000, "type": "ANTACID"}])
        self.assertEqual(saved["antacids_used"], 1)
        with self.assertRaises(InputReplayError) as raised:
            replay_input_log(active_match(), threshold_events + [{"seq": 21, "t_ms": 4100, "type": "ANTACID"}])
        self.assertEqual(raised.exception.reason, "action_during_burnout")

    def test_physical_rate_client_gating_never_logs_authoritative_burnout_actions(self):
        events = []
        heat = 0
        warning_until = 0
        burnout_until = 0
        last_bite_at = None
        last_cooling_at = 0
        for timestamp in range(100, 60_001, 100):
            if warning_until and timestamp >= warning_until:
                burnout_until = warning_until + 1_500
                last_cooling_at = warning_until
                warning_until = 0
                heat = 68
            if burnout_until and timestamp < burnout_until:
                continue
            if burnout_until and timestamp >= burnout_until:
                burnout_until = 0
            if last_bite_at is not None and not warning_until and heat > 0:
                cooling_from = max(last_cooling_at, last_bite_at + 450)
                if timestamp > cooling_from:
                    heat = max(0, heat - 9 * (timestamp - cooling_from) / 1000)
                    last_cooling_at = timestamp
            events.append({"seq": len(events) + 1, "t_ms": timestamp, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5})
            heat = min(100, heat + 5)
            if heat >= 100 and not warning_until:
                warning_until = timestamp + 2_000
            last_bite_at = timestamp
            last_cooling_at = timestamp
        replay = replay_input_log(active_match(), events)
        self.assertEqual(replay["accepted_taps"], len(events))
        self.assertGreater(len(events), 92)

    def test_start_creates_secret_seed_without_exposing_it(self):
        player = {"device_id": "player-a", "coins": 1000, "antacid": 3, "xp": 0, "elo": 1000}
        stored = {}
        contest = active_match()["challenge_config"] | {"id": "nathans", "entry_fee": 0}
        opponent = {"id": "opponent-a", "difficulty": "easy", "tap_speed": 1, "accuracy": 1, "combo_skill": 0}
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "get_contest", return_value=contest),
            patch.object(match_service, "_opponent_for", return_value=opponent),
            patch.object(match_service, "start_player_match", side_effect=lambda _d, _f, match: stored.update(match) or player),
        ):
            response = match_service.start_match("player-a", "nathans")
        self.assertEqual(len(stored["match_seed"]), 64)
        self.assertEqual(stored["validation_version"], 2)
        self.assertEqual(response["server_time"], response["server_started_at"])
        self.assertNotIn("match_seed", response)
        self.assertNotIn(stored["match_seed"], repr(response))
        recovery_now = datetime.fromisoformat(stored["started_at"]) + timedelta(seconds=1)
        with patch.object(match_service, "find_internal_player", return_value={"active_match": stored}), \
                patch.object(match_service, "expire_stale_match", return_value=False), \
                patch.object(match_service, "_utc_now", return_value=recovery_now):
            recovery = match_service.recover_match("player-a")
        self.assertEqual(recovery["server_time"], recovery_now.isoformat())
        self.assertGreaterEqual(
            datetime.fromisoformat(recovery["server_time"]),
            datetime.fromisoformat(recovery["started_at"]),
        )
        self.assertNotIn("match_seed", recovery)

    def test_valid_log_replays_official_score_and_combo(self):
        replay = replay_input_log(active_match(), bite_events())
        self.assertEqual(replay["status"], "VALID")
        self.assertEqual(replay["accepted_taps"], 60)
        self.assertGreater(replay["replayed_score"], 0)
        self.assertGreater(replay["maximum_combo"], 0)

    def test_malformed_sequence_and_out_of_order_time_are_invalid(self):
        for events, reason in (
            ([{"seq": 2, "t_ms": 10, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "malformed_sequence"),
            ([{"seq": 1, "t_ms": 20, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}, {"seq": 2, "t_ms": 10, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "out_of_order_timestamp"),
        ):
            with self.assertRaises(InputReplayError) as raised:
                replay_input_log(active_match(), events)
            self.assertEqual(raised.exception.reason, reason)

    def test_impossible_rate_end_time_unsupported_action_and_mode_are_invalid(self):
        cases = (
            ([{"seq": i + 1, "t_ms": i, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5} for i in range(31)], "impossible_input_rate"),
            ([{"seq": 1, "t_ms": 61_000, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "action_after_match_end"),
            ([{"seq": 1, "t_ms": 10, "type": "CHEAT"}], "unsupported_action"),
            ([{"seq": 1, "t_ms": 10, "type": "SLICE"}], "action_mode_mismatch"),
        )
        for events, reason in cases:
            with self.assertRaises(InputReplayError) as raised:
                replay_input_log(active_match(), events)
            self.assertEqual(raised.exception.reason, reason)

    def test_antacid_misuse_is_invalid(self):
        with self.assertRaises(InputReplayError) as raised:
            replay_input_log(active_match(), [{"seq": 1, "t_ms": 100, "type": "ANTACID"}])
        self.assertEqual(raised.exception.reason, "invalid_antacid_use")

    def test_valid_antacid_use_is_replayed_from_authoritative_inventory(self):
        events = [
            {"seq": 1, "t_ms": 100, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5},
            {"seq": 2, "t_ms": 700, "type": "ANTACID"},
            {"seq": 3, "t_ms": 900, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5},
        ]
        replay = replay_input_log(active_match(), events)
        self.assertEqual(replay["antacids_used"], 1)
        self.assertEqual(replay["accepted_taps"], 2)

    def test_score_tampering_is_rejected_before_settlement(self):
        active = active_match()
        malicious = valid_result(active, score=90)
        player = {"device_id": "player-a", "active_match": active}
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "transition_player_match"),
            patch.object(match_service, "settle_player_match") as settle,
        ):
            with self.assertRaises(match_service.MatchValidationError) as raised:
                match_service.submit_result(malicious)
        self.assertEqual(raised.exception.reason, "score_replay_mismatch")
        settle.assert_not_called()

    def test_client_cannot_forge_opponent_score(self):
        with patch.object(match_service, "transition_player_match"):
            with self.assertRaises(match_service.MatchValidationError) as raised:
                match_service._validate_result(active_match(), valid_result(opponent_score=999), NOW)
        self.assertEqual(raised.exception.reason, "impossible_opponent_result")

    def test_valid_settlement_uses_replayed_score_and_identical_retry_is_idempotent(self):
        active = active_match()
        submitted = valid_result(active)
        player = {"device_id": "player-a", "coins": 100, "xp": 0, "active_match": active}
        settle_calls = []

        def settle(_device_id, _match_id, pipeline):
            settle_calls.append(pipeline)
            finalized = pipeline[0]["$set"]["last_match_result"]
            player["last_match_result"] = finalized
            player.pop("active_match", None)
            return player

        with (
            patch.object(match_service, "find_internal_player", side_effect=lambda _device_id: player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "settle_player_match", side_effect=settle),
        ):
            first = match_service.submit_result(submitted)
            duplicate = match_service.submit_result(submitted)
        replay = replay_input_log(active, submitted.input_events)
        self.assertEqual(first["accepted_score"], replay["replayed_score"])
        self.assertEqual(first["authoritative_outcome"], "win")
        self.assertEqual(first["authoritative_opponent_score"], 50)
        self.assertEqual(first["anti_cheat"]["validation_version"], 2)
        self.assertTrue(duplicate["already_finalized"])
        self.assertEqual(len(settle_calls), 1)

    def test_antacid_event_does_not_count_as_impossible_scoring_rate(self):
        events = [
            {"seq": index + 1, "t_ms": index, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}
            for index in range(30)
        ]
        events.append({"seq": 31, "t_ms": 30, "type": "ANTACID"})

        replay = replay_input_log(active_match(), events)

        self.assertEqual(replay["accepted_taps"], 30)
        self.assertEqual(replay["antacids_used"], 1)
        self.assertEqual(replay["peak_input_rate"], 30)

    def test_logged_timestamp_latency_can_underreport_progress_without_rejecting(self):
        active = active_match()
        active["allowed_duration_sec"] = 120
        active["started_at"] = (NOW - timedelta(seconds=120)).isoformat()
        active["challenge_config"]["duration_sec"] = 120
        active["opponent_config"]["duration_sec"] = 120
        events = [
            SimpleNamespace(seq=index + 1, t_ms=(index + 1) * 1200, type="BITE", source="CONTROL", x=0.5, y=0.5)
            for index in range(95)
        ]
        replay = replay_input_log(active, events)
        submitted = valid_result(
            active,
            events,
            duration_sec=120,
            completed_progress=round(replay["completed_progress"] - 0.5, 6),
        )

        validation, outcome = match_service._validate_result(active, submitted, NOW)

        self.assertIn(outcome, {"accepted", "suspicious_but_accepted"})
        self.assertEqual(validation["replay"]["completed_progress"], replay["completed_progress"])

    def test_progress_replay_still_rejects_overclaimed_progress(self):
        active = active_match()
        events = bite_events(count=30, spacing=300)
        replay = replay_input_log(active, events)
        submitted = valid_result(
            active,
            events,
            completed_progress=round(replay["completed_progress"] + 0.01, 6),
        )

        with patch.object(match_service, "transition_player_match"):
            with self.assertRaises(match_service.MatchValidationError) as raised:
                match_service._validate_result(active, submitted, NOW)

        self.assertEqual(raised.exception.reason, "progress_replay_mismatch")
    def test_progress_replay_rejection_logs_safe_delta_diagnostics(self):
        active = active_match()
        events = bite_events(count=30, spacing=300)
        replay = replay_input_log(active, events)
        submitted = valid_result(
            active,
            events,
            completed_progress=round(replay["completed_progress"] + 0.01, 6),
        )

        with patch.object(match_service, "transition_player_match"), self.assertLogs(match_service.logger, level="WARNING") as captured:
            with self.assertRaises(match_service.MatchValidationError) as raised:
                match_service._validate_result(active, submitted, NOW, request_id="req-progress", started=0.0)

        logs = " ".join(captured.output)
        self.assertEqual(raised.exception.reason, "progress_replay_mismatch")
        self.assertIn("request_id=req-progress", logs)
        self.assertIn("submitted_progress", logs)
        self.assertIn("replayed_progress", logs)
        self.assertIn("progress_delta", logs)
        self.assertIn("progress_epsilon", logs)
        self.assertIn("submitted_score", logs)
        self.assertIn("replayed_score", logs)
        self.assertIn("score_delta", logs)
        self.assertIn("score_tolerance", logs)

    def test_action_during_burnout_logs_replay_event_diagnostics(self):
        active = active_match()
        events = [
            SimpleNamespace(seq=index + 1, t_ms=(index + 1) * 100, type="BITE", source="CONTROL", x=0.5, y=0.5)
            for index in range(20)
        ]
        events.append(SimpleNamespace(seq=21, t_ms=4000, type="BITE", source="CONTROL", x=0.5, y=0.5))
        submitted = SimpleNamespace(
            device_id="player-a",
            match_id="match-a",
            contest_id="nathans",
            opponent_id="opponent-a",
            score=20,
            opponent_score=50,
            duration_sec=60,
            accepted_taps=21,
            completed_progress=20,
            maximum_combo=19,
            tums_used=0,
            completion_reason="timer_completed",
            is_tournament=False,
            validation_version=2,
            input_events=events,
        )

        with patch.object(match_service, "transition_player_match"), self.assertLogs(match_service.logger, level="WARNING") as captured:
            with self.assertRaises(match_service.MatchValidationError) as raised:
                match_service._validate_result(active, submitted, NOW, request_id="req-burnout", started=0.0)

        logs = " ".join(captured.output)
        self.assertEqual(raised.exception.reason, "action_during_burnout")
        self.assertIn("request_id=req-burnout", logs)
        self.assertIn("event_index", logs)
        self.assertIn("action_type", logs)
        self.assertIn("event_t_ms", logs)
        self.assertIn("replayed_heat_before_action", logs)
        self.assertIn("burnout_start_ms", logs)
        self.assertIn("burnout_end_ms", logs)
        self.assertIn("previous_event_delta_ms", logs)

if __name__ == "__main__":
    unittest.main()
