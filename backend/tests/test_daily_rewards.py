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
        self.assertEqual(len(status["reward_slices"]), 12)

    def test_reward_table_has_twelve_unique_positive_weighted_entries(self):
        ids = [reward["id"] for reward in daily.DAILY_REWARD_TABLE]
        self.assertEqual(len(ids), 12)
        self.assertEqual(len(set(ids)), 12)
        self.assertEqual(ids, [
            "small_coins", "medium_coins", "large_coins",
            "small_xp", "medium_xp", "large_xp", "large_xp_bonus",
            "one_antacid", "two_antacids", "antacid_bundle",
            "jackpot_coins", "jackpot_xp",
        ])
        self.assertTrue(all(reward["weight"] > 0 for reward in daily.DAILY_REWARD_TABLE))
        self.assertEqual(daily.TOTAL_REWARD_WEIGHT, 100)

        by_id = {reward["id"]: reward for reward in daily.DAILY_REWARD_TABLE}
        self.assertEqual(by_id["large_xp_bonus"]["kind"], "xp")
        self.assertEqual(by_id["large_xp_bonus"]["amount"], 1000)
        self.assertEqual(by_id["antacid_bundle"]["kind"], "antacid")
        self.assertEqual(by_id["antacid_bundle"]["amount"], 3)
        self.assertLess(by_id["large_xp_bonus"]["weight"], by_id["small_xp"]["weight"])
        self.assertLess(by_id["large_xp_bonus"]["weight"], by_id["medium_xp"]["weight"])
        self.assertLess(by_id["antacid_bundle"]["weight"], by_id["one_antacid"]["weight"])
        self.assertLess(by_id["jackpot_coins"]["weight"], by_id["small_coins"]["weight"])
        self.assertLess(by_id["jackpot_xp"]["weight"], by_id["small_xp"]["weight"])

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

    def test_new_rewards_update_the_existing_balances_exactly(self):
        by_id = {reward["id"]: (index, reward) for index, reward in enumerate(daily.DAILY_REWARD_TABLE)}
        for reward_id, balance_field, expected_increment in (
            ("large_xp_bonus", "xp", 1000),
            ("antacid_bundle", "antacid", 3),
        ):
            self.setUp()
            index, reward = by_id[reward_id]
            pick = sum(entry["weight"] for entry in daily.DAILY_REWARD_TABLE[:index])
            before = self.player[balance_field]
            with (
                patch.object(daily, "find_player", side_effect=self.read),
                patch.object(daily, "update_player_document", side_effect=self.update),
            ):
                result = daily.claim_daily_spin("guest_daily", NOW, lambda _limit, value=pick: value)
            self.assertEqual(result["reward"]["id"], reward_id)
            self.assertEqual(result["reward"]["amount"], reward["amount"])
            self.assertEqual(self.player[balance_field], before + expected_increment)

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
