"""Regression tests for the one-time closed beta welcome pack."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from data.shop import get_shop_item
from services import shop_service


class ClosedBetaWelcomePackTests(unittest.TestCase):
    def test_catalog_replaces_unlimited_coin_bundle(self):
        self.assertIsNone(get_shop_item("coin_bundle"))
        pack = get_shop_item("closed_beta_welcome_pack")
        self.assertIsNotNone(pack)
        self.assertEqual(pack["coin_reward"], 50000)
        self.assertEqual(pack["xp_reward"], 5000)

    def test_claim_is_atomic_persistent_and_granted_only_once(self):
        persisted_player = {
            "device_id": "guest_beta",
            "coins": 125,
            "xp": 75,
            "antacid": 2,
            "owned_gear": [],
            "closed_beta_welcome_pack_claimed": False,
        }
        update_calls = []

        def read_player(_device_id):
            return dict(persisted_player)

        def atomic_update(_device_id, update, *, extra_filter=None):
            update_calls.append((update, extra_filter))
            if persisted_player["closed_beta_welcome_pack_claimed"]:
                return None
            for field, amount in update["$inc"].items():
                persisted_player[field] += amount
            persisted_player.update(update["$set"])
            return dict(persisted_player)

        with (
            patch.object(shop_service, "get_or_create_player", side_effect=read_player),
            patch.object(shop_service, "find_player", side_effect=read_player),
            patch.object(shop_service, "update_player_document", side_effect=atomic_update),
        ):
            first_claim = shop_service.purchase_item(
                "guest_beta",
                "closed_beta_welcome_pack",
            )
            with self.assertRaises(shop_service.WelcomePackAlreadyClaimedError):
                shop_service.purchase_item(
                    "guest_beta",
                    "closed_beta_welcome_pack",
                )

        self.assertEqual(first_claim["new_coins"], 50125)
        self.assertEqual(first_claim["new_xp"], 5075)
        self.assertTrue(first_claim["closed_beta_welcome_pack_claimed"])
        self.assertEqual(persisted_player["coins"], 50125)
        self.assertEqual(persisted_player["xp"], 5075)
        self.assertEqual(len(update_calls), 2)
        self.assertEqual(
            update_calls[0][1],
            {"closed_beta_welcome_pack_claimed": {"$ne": True}},
        )

    def test_only_owned_gameplay_gear_can_be_equipped(self):
        player = {
            "device_id": "guest_gear",
            "owned_gear": ["tap_boost", "gold_apron"],
        }
        updated = {**player, "equipped_gear": "tap_boost"}
        with (
            patch.object(shop_service, "find_player", return_value=player),
            patch.object(shop_service, "update_player_document", return_value=updated),
        ):
            result = shop_service.equip_item("guest_gear", "tap_boost")
            self.assertEqual(result["equipped_gear"], "tap_boost")

            with self.assertRaises(shop_service.GearNotOwnedError):
                shop_service.equip_item("guest_gear", "gold_apron")

            with self.assertRaises(shop_service.GearNotOwnedError):
                shop_service.equip_item("guest_gear", "unknown_gear")


if __name__ == "__main__":
    unittest.main()
