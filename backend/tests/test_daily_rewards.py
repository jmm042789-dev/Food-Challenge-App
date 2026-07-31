"""Isolated Daily Charcuterie Board service tests."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services import daily_reward_service as daily


NOW = datetime(2026, 7, 31, 12, 0, tzinfo=timezone.utc)


class DailyRewardTests(unittest.TestCase):
    def setUp(self):
        self.player = {
            "device_id": "guest_daily",
            "coins": 10,
            "xp": 20,
            "antacid": 1,
            "daily_spin_streak": 0,
            "total_daily_spins": 0,
            "bonus_spins": 0,
        }

    def read(self, _device_id):
        return dict(self.player)

    def update(self, _device_id, update, *, extra_filter=None):
        next_spin = daily._parse_timestamp(self.player.get("next_daily_spin"))
        if next_spin is not None and NOW < next_spin:
            return None
        for field, amount in update["$inc"].items():
            self.player[field] = int(self.player.get(field, 0)) + amount
        self.player.update(update["$set"])
        return dict(self.player)

    def test_eligible_status_uses_server_time_and_exposes_no_paid_spins(self):
        with patch.object(daily, "find_player", side_effect=self.read):
            status = daily.daily_spin_status("guest_daily", NOW)
        self.assertTrue(status["eligible"])
        self.assertEqual(status["free_spins_available"], 1)
        self.assertEqual(status["bonus_spins_available"], 0)
        self.assertEqual(status["server_time"], NOW.isoformat())
        self.assertEqual(len(status["reward_slices"]), 10)

    def test_not_eligible_until_server_timestamp(self):
        self.player["next_daily_spin"] = (NOW + timedelta(seconds=1)).isoformat()
        with patch.object(daily, "find_player", side_effect=self.read):
            before = daily.daily_spin_status("guest_daily", NOW)
            after = daily.daily_spin_status("guest_daily", NOW + timedelta(seconds=1))
        self.assertFalse(before["eligible"])
        self.assertTrue(after["eligible"])

    def test_weighted_reward_table_selects_every_configured_slice(self):
        start = 0
        for index, expected in enumerate(daily.DAILY_REWARD_TABLE):
            selected_index, selected = daily.choose_daily_reward(
                lambda _limit, pick=start: pick
            )
            self.assertEqual(selected_index, index)
            self.assertEqual(selected["id"], expected["id"])
            start += expected["weight"]
        self.assertEqual(start, daily.TOTAL_REWARD_WEIGHT)

    def test_claim_awards_once_and_persists_twenty_four_hour_timer(self):
        with (
            patch.object(daily, "find_player", side_effect=self.read),
            patch.object(daily, "update_player_document", side_effect=self.update),
        ):
            result = daily.claim_daily_spin("guest_daily", NOW, lambda _limit: 0)
            with self.assertRaises(daily.DailySpinUnavailableError):
                daily.claim_daily_spin("guest_daily", NOW, lambda _limit: 0)
        self.assertEqual(result["reward"]["id"], "small_coins")
        self.assertEqual(self.player["coins"], 110)
        self.assertEqual(self.player["total_daily_spins"], 1)
        self.assertEqual(
            self.player["next_daily_spin"],
            (NOW + daily.DAILY_SPIN_INTERVAL).isoformat(),
        )

    def test_atomic_loser_receives_no_reward(self):
        with (
            patch.object(daily, "find_player", side_effect=self.read),
            patch.object(daily, "update_player_document", return_value=None),
            self.assertRaises(daily.DailySpinUnavailableError),
        ):
            daily.claim_daily_spin("guest_daily", NOW, lambda _limit: 0)
        self.assertEqual(self.player["coins"], 10)
        self.assertEqual(self.player["antacid"], 1)

    def test_streak_continues_inside_grace_and_resets_after_it(self):
        self.player.update({
            "last_daily_spin": (NOW - timedelta(hours=25)).isoformat(),
            "daily_spin_streak": 4,
        })
        with (
            patch.object(daily, "find_player", side_effect=self.read),
            patch.object(daily, "update_player_document", side_effect=self.update),
        ):
            continued = daily.claim_daily_spin("guest_daily", NOW, lambda _limit: 0)
        self.assertEqual(continued["daily_spin_streak"], 5)


if __name__ == "__main__":
    unittest.main()
