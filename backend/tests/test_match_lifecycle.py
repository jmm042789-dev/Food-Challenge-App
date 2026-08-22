"""Focused RC2 match-lifecycle tests; no external services are used."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import server
import database
from services import match_service


NOW = datetime(2026, 7, 24, 12, 0, tzinfo=timezone.utc)


def active_match(*, age_seconds=0, match_id="match-a", started_at=None):
    start = started_at or (NOW - timedelta(seconds=age_seconds)).isoformat()
    try:
        start_datetime = datetime.fromisoformat(start)
    except ValueError:
        start_datetime = NOW
    return {
        "schema_version": match_service.MATCH_SCHEMA_VERSION,
        "validation_version": 2,
        "match_seed": "b" * 64,
        "id": match_id,
        "device_id": "player-a",
        "contest_id": "nathans",
        "opponent_id": "opponent-a",
        "status": "active",
        "started_at": start,
        "allowed_duration_sec": 60,
        "expires_at": (
            start_datetime
            + timedelta(seconds=60 + match_service.MATCH_SUBMISSION_GRACE_SECONDS)
        ).isoformat(),
        "starting_antacid": 3,
        "equipped_gear": None,
        "perk_modifiers": dict(match_service.BASE_PERK_MODIFIERS),
        "challenge_config": {"prize_pool": 500, "heat_per_tap": 5, "bite_mechanic": "tap"},
        "opponent_config": {
            "seed": 123,
            "final_score": 50,
            "pace_per_sec": 50 / 60,
            "duration_sec": 60,
            "opponent": {"id": "opponent-a"},
        },
        "start_response": {
            "match_id": match_id,
            "contest": {"id": "nathans"},
            "opponent": {"id": "opponent-a"},
        },
    }


def result(**overrides):
    timestamp = 0
    events = []
    for index in range(60):
        if index and index % 10 == 0:
            timestamp += 2_500
        timestamp += 600
        events.append(SimpleNamespace(seq=index + 1, t_ms=timestamp, type="BITE", source="CONTROL", x=0.5, y=0.5))
    replay = match_service.replay_input_log(active_match(age_seconds=60), events)
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
        "tums_used": 0,
        "completion_reason": "timer_completed",
        "is_tournament": False,
        "validation_version": 2,
        "input_events": events,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class MatchLifecycleTests(unittest.TestCase):
    def setUp(self):
        match_service.queue[:] = []
        match_service.active_matches.clear()

    def test_valid_active_match_remains_resumable(self):
        player = {"device_id": "player-a", "active_match": active_match(age_seconds=30)}
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "_utc_now", return_value=NOW),
        ):
            recovery = match_service.recover_match("player-a")
        self.assertEqual(recovery["status"], "resumable")
        self.assertEqual(recovery["match_id"], "match-a")

    def test_stale_active_match_expires_and_cleans_matchmaking(self):
        player = {
            "device_id": "player-a",
            "active_match": active_match(
                age_seconds=match_service.MATCH_RECOVERY_WINDOW_SECONDS,
            ),
        }
        match_service.queue.append({"device_id": "player-a", "time": NOW.timestamp()})
        match_service.active_matches["pair-a"] = {"players": ["player-a", "player-b"]}
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "transition_player_match", return_value=player) as transition,
        ):
            self.assertTrue(match_service.expire_stale_match("player-a", NOW))
        transition.assert_called_once()
        self.assertEqual(match_service.queue, [])
        self.assertEqual(match_service.active_matches, {})

    def test_expired_match_cannot_grant_rewards(self):
        settle = Mock()
        with (
            patch.object(match_service, "find_internal_player", return_value={"device_id": "player-a"}),
            patch.object(match_service, "expire_stale_match", return_value=True),
            patch.object(match_service, "settle_player_match", settle),
            self.assertRaises(match_service.MatchExpiredError),
        ):
            match_service.submit_result(result())
        settle.assert_not_called()

    def test_cancelled_match_cannot_grant_rewards(self):
        player = {
            "device_id": "player-a",
            "last_match_lifecycle": {"match_id": "match-a", "status": "cancelled"},
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "settle_player_match") as settle,
            self.assertRaises(match_service.MatchNotFoundError),
        ):
            match_service.submit_result(result())
        settle.assert_not_called()

    def test_cancellation_endpoint_uses_authenticated_owner(self):
        with (
            patch.object(server, "authenticated_bearer_player", return_value={"device_id": "player-a"}),
            patch.object(server, "cancel_match", return_value={"status": "cancelled"}) as cancel,
        ):
            response = server.abandon_match_endpoint("Bearer private")
        self.assertEqual(response, {"status": "cancelled"})
        cancel.assert_called_once_with("player-a")

    def test_cancellation_is_idempotent(self):
        player = {
            "device_id": "player-a",
            "last_match_lifecycle": {"match_id": "match-a", "status": "cancelled"},
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
        ):
            self.assertEqual(match_service.cancel_match("player-a"), {"status": "cancelled"})

    def test_duplicate_identical_result_returns_previous_response(self):
        fingerprint = match_service._fingerprint(result())
        player = {
            "device_id": "player-a",
            "last_match_result": {
                "match_id": "match-a",
                "fingerprint": fingerprint,
                "response": {"coin_reward": 50},
            },
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "settle_player_match") as settle,
        ):
            duplicate = match_service.submit_result(result())
            self.assertEqual(duplicate["coin_reward"], 50)
            self.assertTrue(duplicate["already_finalized"])
        settle.assert_not_called()

    def test_conflicting_duplicate_result_is_rejected(self):
        player = {
            "device_id": "player-a",
            "last_match_result": {
                "match_id": "match-a",
                "fingerprint": match_service._fingerprint(result(score=99)),
                "response": {"coin_reward": 50},
            },
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            self.assertRaises(match_service.MatchNotFoundError),
        ):
            match_service.submit_result(result(score=100))

    def test_settled_match_cannot_be_cancelled(self):
        player = {
            "device_id": "player-a",
            "last_match_lifecycle": {"match_id": "match-a", "status": "settled"},
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
        ):
            self.assertEqual(match_service.cancel_match("player-a"), {"status": "settled"})

    def test_another_player_cannot_select_match_for_recovery_or_cancel(self):
        with (
            patch.object(server, "authenticated_bearer_player", return_value={"device_id": "player-b"}),
            patch.object(server, "recover_match", return_value={"status": "absent"}) as recover,
        ):
            server.active_match_endpoint("Bearer player-b")
        recover.assert_called_once_with("player-b")

    def test_deleted_player_cannot_recover(self):
        with (
            patch.object(match_service, "find_internal_player", return_value=None),
            self.assertRaises(match_service.PlayerNotFoundError),
        ):
            match_service.recover_match("deleted-player")

    def test_malformed_or_missing_timestamp_expires_safely(self):
        for timestamp in (None, "not-a-date"):
            malformed = active_match(started_at=timestamp or "not-a-date")
            if timestamp is None:
                malformed.pop("started_at")
            self.assertTrue(match_service._match_is_stale(malformed, NOW))

    def test_stale_queue_and_pairing_records_are_cleaned(self):
        match_service.queue.extend(
            [
                {"device_id": "old", "time": NOW.timestamp() - 121},
                {"device_id": "fresh", "time": NOW.timestamp() - 10},
                {"device_id": "malformed"},
            ]
        )
        match_service.active_matches.update(
            {
                "old": {"players": ["a", "b"], "created": NOW.timestamp() - 121},
                "fresh": {"players": ["c", "d"], "created": NOW.timestamp() - 10},
            }
        )
        match_service.cleanup_stale_matchmaking_state(NOW.timestamp())
        self.assertEqual([entry["device_id"] for entry in match_service.queue], ["fresh"])
        self.assertEqual(set(match_service.active_matches), {"fresh"})

    def test_new_contest_can_start_after_stale_cleanup(self):
        player = {"device_id": "player-a", "coins": 100, "antacid": 0}
        stored = {}

        def start(_device_id, _entry_fee, match):
            stored.update(match)
            return {"active_match": match}

        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=True),
            patch.object(match_service, "get_contest", return_value={
                "id": "next",
                "entry_fee": 0,
                "difficulty": "easy",
            }),
            patch.object(match_service, "_opponent_for", return_value={
                "id": "opponent-a",
                "difficulty": "easy",
                "tap_speed": 1,
            }),
            patch.object(match_service, "start_player_match", side_effect=start),
        ):
            response = match_service.start_match("player-a", "next")
        self.assertEqual(response["match_id"], stored["id"])
        self.assertEqual(stored["status"], "active")

    def test_match_start_records_authoritative_snapshot(self):
        player = {
            "device_id": "player-a",
            "player_id": "account-a",
            "coins": 1000,
            "xp": 25,
            "elo": 1000,
            "antacid": 4,
            "equipped_gear": "tap_boost",
        }
        stored = {}

        def start(_device_id, _entry_fee, match):
            stored.update(match)
            return {**player, "coins": 950, "active_match": match}

        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "get_contest", return_value={
                "id": "nathans",
                "entry_fee": 50,
                "prize_pool": 500,
                "duration_sec": 60,
                "difficulty": "easy",
                "heartburn_per_bite": 2,
                "bite_mechanic": "tap",
            }),
            patch.object(match_service, "_opponent_for", return_value={
                "id": "opponent-a",
                "difficulty": "easy",
                "tap_speed": 1,
            }),
            patch.object(match_service, "start_player_match", side_effect=start),
        ):
            response = match_service.start_match("player-a", "nathans")

        self.assertEqual(stored["player_id"], "account-a")
        self.assertEqual(stored["equipped_gear"], "tap_boost")
        self.assertEqual(stored["perk_modifiers"]["tap_power"], 2)
        self.assertEqual(stored["starting_antacid"], 4)
        self.assertEqual(stored["entry_fee_charged"], 50)
        self.assertEqual(stored["allowed_duration_sec"], 60)
        self.assertEqual(stored["opponent_config"]["opponent"]["id"], "opponent-a")
        self.assertGreater(stored["opponent_config"]["final_score"], 0)
        self.assertEqual(response["player_tums"], 4)
        self.assertEqual(response["authoritative_duration_sec"], 60)
        self.assertEqual(response["opponent_config"], stored["opponent_config"])

    def test_unknown_equipment_uses_base_authoritative_stats(self):
        gear, modifiers = match_service.authoritative_perk_config("future_item")
        self.assertIsNone(gear)
        self.assertEqual(modifiers, match_service.BASE_PERK_MODIFIERS)

    def test_each_gameplay_perk_uses_trusted_server_values(self):
        expected = {
            "tap_boost": ("tap_power", 2),
            "combo_boost": ("combo_window_ms", 875),
            "score_multiplier": ("score_multiplier", 1.5),
        }
        for gear_id, (field, value) in expected.items():
            with self.subTest(gear_id=gear_id):
                normalized, modifiers = match_service.authoritative_perk_config(
                    gear_id
                )
                self.assertEqual(normalized, gear_id)
                self.assertEqual(modifiers[field], value)

    def test_plausible_fast_tap_boost_result_is_accepted(self):
        match = active_match(age_seconds=60)
        match["equipped_gear"] = "tap_boost"
        match["perk_modifiers"] = dict(
            match_service.GEAR_PERK_MODIFIERS["tap_boost"]
        )
        events = []
        for cycle in range(11):
            cycle_start = cycle * 5_400
            for offset in range(19):
                events.append(SimpleNamespace(seq=len(events) + 1, t_ms=cycle_start + (offset + 1) * 100, type="BITE", source="CONTROL", x=0.5, y=0.5))
        replay = match_service.replay_input_log(match, events)
        bounds, outcome = match_service._validate_result(
            match,
            result(
                accepted_taps=replay["accepted_taps"],
                completed_progress=replay["completed_progress"],
                maximum_combo=replay["maximum_combo"],
                score=replay["replayed_score"],
                input_events=events,
            ),
            NOW,
        )
        self.assertGreaterEqual(bounds["maximum_taps"], len(events))
        self.assertIn(outcome, {"accepted", "suspicious_but_accepted"})

    def test_impossible_taps_reject_and_close_match(self):
        match = active_match(age_seconds=60)
        with (
            patch.object(match_service, "transition_player_match") as transition,
            self.assertRaises(match_service.MatchValidationError) as raised,
        ):
            match_service._validate_result(
                match,
                result(accepted_taps=5000, completed_progress=5000),
                NOW,
            )
        self.assertEqual(raised.exception.reason, "impossible_taps")
        transition.assert_called_once()
        self.assertEqual(transition.call_args.kwargs["rejection_reason"], "impossible_taps")

    def test_impossible_score_relative_to_submitted_taps_is_rejected(self):
        with (
            patch.object(match_service, "transition_player_match"),
            self.assertRaises(match_service.MatchValidationError) as raised,
        ):
            match_service._validate_result(
                active_match(age_seconds=60),
                result(
                    score=10000,
                    accepted_taps=1,
                    completed_progress=1,
                    maximum_combo=0,
                ),
                NOW,
            )
        self.assertEqual(raised.exception.reason, "impossible_score")

    def test_zero_activity_positive_score_exploit_is_terminally_rejected(self):
        malicious = result(
            score=100,
            opponent_score=0,
            accepted_taps=0,
            completed_progress=0,
            maximum_combo=0,
        )
        match = active_match(age_seconds=60)
        player = {
            "device_id": "player-a",
            "coins": 100,
            "xp": 0,
            "antacid": 3,
            "active_match": match,
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "transition_player_match") as transition,
            patch.object(match_service, "settle_player_match") as settle,
            self.assertRaises(match_service.MatchValidationError) as raised,
        ):
            match_service.submit_result(malicious)
        self.assertEqual(raised.exception.reason, "impossible_score")
        self.assertEqual(transition.call_args.kwargs["rejection_reason"], "impossible_score")
        settle.assert_not_called()

        rejected_player = {
            "device_id": "player-a",
            "last_match_lifecycle": {"match_id": "match-a", "status": "rejected"},
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=rejected_player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "settle_player_match") as settle,
            self.assertRaises(match_service.MatchValidationError),
        ):
            match_service.submit_result(result(score=1, accepted_taps=1, completed_progress=1, maximum_combo=0))
        settle.assert_not_called()

    def test_zero_taps_cannot_report_progress(self):
        with (
            patch.object(match_service, "transition_player_match"),
            self.assertRaises(match_service.MatchValidationError) as raised,
        ):
            match_service._validate_result(
                active_match(age_seconds=60),
                result(score=0, accepted_taps=0, completed_progress=1, maximum_combo=0),
                NOW,
            )
        self.assertEqual(raised.exception.reason, "impossible_progress")

    def test_plausible_low_activity_score_is_accepted(self):
        events = [SimpleNamespace(seq=1, t_ms=1000, type="BITE", source="CONTROL", x=0.5, y=0.5)]
        _, outcome = match_service._validate_result(
            active_match(age_seconds=60),
            result(score=1, accepted_taps=1, completed_progress=1, maximum_combo=0, input_events=events),
            NOW,
        )
        self.assertEqual(outcome, "accepted")

    def test_combo_timing_and_action_count_are_bounded(self):
        match = active_match(age_seconds=60)
        match["equipped_gear"] = "combo_boost"
        match["perk_modifiers"] = dict(match_service.GEAR_PERK_MODIFIERS["combo_boost"])
        bounds = match_service._plausibility_bounds(match, result(), 60)
        self.assertEqual(bounds["combo_window_ms"], 875)
        with (
            patch.object(match_service, "transition_player_match"),
            self.assertRaises(match_service.MatchValidationError) as raised,
        ):
            match_service._validate_result(match, result(maximum_combo=60), NOW)
        self.assertEqual(raised.exception.reason, "impossible_combo")

    def test_fresh_stomach_score_benefit_requires_antacid_time(self):
        match = active_match(age_seconds=60)
        without_antacid = match_service._plausibility_bounds(match, result(tums_used=0), 60)
        with_antacid = match_service._plausibility_bounds(match, result(tums_used=1), 60)
        self.assertGreater(with_antacid["maximum_score"], without_antacid["maximum_score"])
        with (
            patch.object(match_service, "transition_player_match"),
            self.assertRaises(match_service.MatchValidationError) as raised,
        ):
            match_service._validate_result(
                match,
                result(score=without_antacid["maximum_score"] + 1, tums_used=0),
                NOW,
            )
        self.assertEqual(raised.exception.reason, "impossible_score")

    def test_heat_generation_reduces_maximum_progress_conservatively(self):
        match = active_match(age_seconds=60)
        match["equipped_gear"] = "tap_boost"
        match["perk_modifiers"] = dict(match_service.GEAR_PERK_MODIFIERS["tap_boost"])
        telemetry = result(accepted_taps=600, completed_progress=1100, maximum_combo=599)
        bounds = match_service._plausibility_bounds(match, telemetry, 60)
        self.assertEqual(bounds["heat_generation_multiplier"], 1.1)
        self.assertLess(bounds["maximum_progress"], 600 * 2)

    def test_client_opponent_score_cannot_choose_outcome(self):
        match = active_match(age_seconds=60)
        with (
            patch.object(match_service, "transition_player_match"),
            self.assertRaises(match_service.MatchValidationError) as low,
        ):
            match_service._validate_result(match, result(opponent_score=0), NOW)
        self.assertEqual(low.exception.reason, "impossible_opponent_result")
        with (
            patch.object(match_service, "transition_player_match"),
            self.assertRaises(match_service.MatchValidationError) as high,
        ):
            match_service._validate_result(match, result(opponent_score=9999), NOW)
        self.assertEqual(high.exception.reason, "impossible_opponent_result")

    def test_timer_result_cannot_arrive_before_plausible_completion(self):
        with (
            patch.object(match_service, "transition_player_match"),
            self.assertRaises(match_service.MatchValidationError) as raised,
        ):
            match_service._validate_result(
                active_match(age_seconds=2),
                result(duration_sec=2),
                NOW,
            )
        self.assertEqual(raised.exception.reason, "impossible_timing")

    def test_inventory_and_progress_are_bounded_by_start_snapshot(self):
        for invalid, reason in (
            (result(tums_used=4), "invalid_inventory"),
            (
                result(accepted_taps=10, completed_progress=20, maximum_combo=9),
                "impossible_progress",
            ),
        ):
            with (
                patch.object(match_service, "transition_player_match"),
                self.assertRaises(match_service.MatchValidationError) as raised,
            ):
                match_service._validate_result(active_match(age_seconds=60), invalid, NOW)
            self.assertEqual(raised.exception.reason, reason)

    def test_valid_settlement_computes_reward_and_settles_once(self):
        match = active_match(age_seconds=60)
        player = {
            "device_id": "player-a",
            "coins": 100,
            "xp": 0,
            "antacid": 3,
            "elo": 1000,
            "active_match": match,
        }
        settled_document = {
            "last_match_result": {
                "response": {
                    "coin_reward": 500,
                    "xp_reward": 50,
                    "new_coins": 600,
                    "new_xp": 50,
                    "new_tums": 2,
                    "accepted_score": 100,
                    "won": True,
                    "validation_outcome": "accepted",
                }
            }
        }
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(
                match_service,
                "settle_player_match",
                return_value=settled_document,
            ) as settle,
        ):
            response = match_service.submit_result(result())
        self.assertEqual(response["coin_reward"], 500)
        self.assertEqual(response["xp_reward"], 50)
        self.assertEqual(response["new_tums"], 2)
        self.assertTrue(response["verified"])
        self.assertEqual(response["match_id"], "match-a")
        self.assertFalse(response["already_finalized"])
        settle.assert_called_once()
        update = settle.call_args.args[2][0]["$set"]
        self.assertEqual(update["last_match_result"]["response"]["coin_reward"], 500)
        self.assertEqual(
            update["antacid"]["$max"][1]["$subtract"][1],
            0,
        )

    def test_server_derives_loss_from_scores_not_client_authority(self):
        match = active_match(age_seconds=60)
        match["opponent_config"]["final_score"] = 200
        player = {
            "device_id": "player-a",
            "coins": 100,
            "xp": 0,
            "antacid": 3,
            "elo": 1000,
            "active_match": match,
        }
        captured = {}

        def settle(_device, _match, pipeline):
            captured.update(pipeline[0]["$set"])
            return {
                "last_match_result": {
                    "response": {
                        "coin_reward": 10,
                        "xp_reward": 15,
                        "new_xp": 15,
                    }
                }
            }

        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(match_service, "settle_player_match", side_effect=settle),
        ):
            match_service.submit_result(result(opponent_score=200))
        self.assertEqual(captured["last_match_result"]["response"]["coin_reward"], 10)
        self.assertEqual(captured["last_match_result"]["response"]["xp_reward"], 15)

    def test_authoritative_opponent_score_controls_tie_and_response(self):
        match = active_match(age_seconds=60)
        replay_score = result().score
        match["opponent_config"]["final_score"] = replay_score
        player = {
            "device_id": "player-a",
            "coins": 100,
            "xp": 0,
            "antacid": 3,
            "elo": 1000,
            "active_match": match,
        }
        captured = {}
        captured_update = {}

        def settle(_device, _match, pipeline):
            captured_update.update(pipeline[0]["$set"])
            response = pipeline[0]["$set"]["last_match_result"]["response"]
            captured.update(response)
            return {"last_match_result": {"response": response}}

        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(match_service, "settle_player_match", side_effect=settle),
        ):
            match_service.submit_result(
                result(opponent_score=replay_score)
            )
        self.assertEqual(captured["authoritative_opponent_score"], replay_score)
        self.assertEqual(captured["authoritative_outcome"], "tie")
        self.assertFalse(captured["won"])
        self.assertEqual(captured["coin_reward"], 10)
        self.assertEqual(captured_update["draws"]["$add"][1], 1)
        self.assertEqual(captured_update["losses"]["$add"][1], 0)

    def test_database_settlement_is_conditioned_on_player_and_active_match(self):
        collection = Mock()
        collection.find_one_and_update.return_value = None
        with patch.object(database, "_players", return_value=collection):
            database.settle_player_match(
                "player-a",
                "match-a",
                [{"$set": {"coins": 999}}],
            )
        query = collection.find_one_and_update.call_args.args[0]
        self.assertEqual(
            query,
            {"device_id": "player-a", "active_match.id": "match-a"},
        )


if __name__ == "__main__":
    unittest.main()
