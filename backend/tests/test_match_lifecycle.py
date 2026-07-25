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
from services import match_service


NOW = datetime(2026, 7, 24, 12, 0, tzinfo=timezone.utc)


def active_match(*, age_seconds=0, match_id="match-a", started_at=None):
    return {
        "id": match_id,
        "device_id": "player-a",
        "contest_id": "nathans",
        "opponent_id": "opponent-a",
        "status": "active",
        "started_at": started_at or (NOW - timedelta(seconds=age_seconds)).isoformat(),
        "start_response": {
            "match_id": match_id,
            "contest": {"id": "nathans"},
            "opponent": {"id": "opponent-a"},
        },
    }


def result(**overrides):
    values = {
        "device_id": "player-a",
        "match_id": "match-a",
        "contest_id": "nathans",
        "opponent_id": "opponent-a",
        "score": 100,
        "duration_sec": 60,
        "won": True,
        "tums_used": 0,
        "is_tournament": False,
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
        ):
            self.assertEqual(
                match_service.submit_result(result()),
                {"coin_reward": 50},
            )

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


if __name__ == "__main__":
    unittest.main()
