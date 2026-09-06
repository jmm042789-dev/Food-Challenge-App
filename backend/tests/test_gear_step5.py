"""Roadmap Step 5 catalog, set, purchase, and replay authority tests."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from data.gear import GEAR, GEAR_SETS
from services import shop_service
from services.match_validation import authoritative_perk_config


class GearCatalogTests(unittest.TestCase):
    def test_catalog_has_nine_unique_items_per_required_slot(self):
        self.assertEqual(len(GEAR), 27)
        self.assertEqual(len({item["id"] for item in GEAR}), 27)
        for slot in ("Hat", "Apron", "Outfit"):
            self.assertEqual(sum(item["slot"] == slot for item in GEAR), 9)
        self.assertTrue({item["rarity"] for item in GEAR} <= {"Common", "Rare", "Epic", "Legendary"})

    def test_tribute_sets_are_valid_three_piece_loadouts(self):
        by_id = {item["id"]: item for item in GEAR}
        for set_id in ("chef_shannon", "chef_lynette", "chef_brittany"):
            pieces = GEAR_SETS[set_id]["pieces"]
            self.assertEqual({by_id[piece]["slot"] for piece in pieces}, {"Hat", "Apron", "Outfit"})
            self.assertTrue(all(by_id[piece]["set_id"] == set_id for piece in pieces))

    def test_set_bonus_requires_exact_three_piece_set(self):
        _, partial = authoritative_perk_config({"hat": "shannon_hat", "apron": "shannon_apron"})
        _, complete = authoritative_perk_config({"hat": "shannon_hat", "apron": "shannon_apron", "outfit": "shannon_outfit"})
        self.assertIsNone(partial["active_set_id"])
        self.assertEqual(complete["active_set_id"], "chef_shannon")
        self.assertLess(complete["heat_generation_multiplier"], partial["heat_generation_multiplier"])


class GearPurchaseTests(unittest.TestCase):
    def test_partial_bundle_charges_only_discounted_remaining_pieces(self):
        before = {"coins": 2000, "level": 10, "owned_gear": ["shannon_hat"]}
        captured = {}
        def update(_device_id, update_doc, extra_filter=None):
            captured.update(update_doc=update_doc, extra_filter=extra_filter)
            return {**before, "coins": before["coins"] + update_doc["$inc"]["coins"], "owned_gear": ["shannon_hat", "shannon_apron", "shannon_outfit"]}
        with patch.object(shop_service, "get_or_create_player", return_value=before), patch.object(shop_service, "update_player_document", side_effect=update):
            response = shop_service.purchase_gear_set("player", "chef_shannon")
        self.assertEqual(response["charged_coins"], int((390 + 450) * .9))
        self.assertEqual(captured["update_doc"]["$addToSet"]["owned_gear"]["$each"], ["shannon_apron", "shannon_outfit"])
        self.assertNotIn("price", captured["extra_filter"])

    def test_owned_bundle_retry_is_idempotent_and_free(self):
        owned = list(GEAR_SETS["chef_lynette"]["pieces"])
        before = {"coins": 500, "level": 10, "owned_gear": owned}
        with patch.object(shop_service, "get_or_create_player", return_value=before), patch.object(shop_service, "update_player_document") as update:
            response = shop_service.purchase_gear_set("player", "chef_lynette")
        self.assertEqual(response["charged_coins"], 0)
        update.assert_not_called()

    def test_equip_uses_authoritative_item_slot(self):
        player = {"owned_gear": ["brittany_apron"]}
        with patch.object(shop_service, "find_player", return_value=player), patch.object(shop_service, "update_player_document", return_value={**player, "equipped_gear_slots": {"apron": "brittany_apron"}}) as update:
            shop_service.equip_item("player", "brittany_apron")
        self.assertEqual(update.call_args.args[1]["$set"]["equipped_gear_slots.apron"], "brittany_apron")


if __name__ == "__main__":
    unittest.main()
