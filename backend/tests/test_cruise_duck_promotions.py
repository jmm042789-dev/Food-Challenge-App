import hashlib
from pathlib import Path
import unittest
from unittest.mock import patch

from services.promotion_service import PromotionError, hash_promotion_code, redeem_cruise_duck

CODE = "FF-1234-5678-9ABC-DEF0-1234"
HASH = hashlib.sha256(CODE.encode()).hexdigest()
PLAYER = {"device_id": "private-device", "coins": 700}

class PromotionTests(unittest.TestCase):
    def test_code_hash_is_normalized_and_raw_code_is_not_authority(self):
        self.assertEqual(hash_promotion_code(" ff-1234-5678-9abc-def0-1234 "), HASH)
        with self.assertRaises(PromotionError): hash_promotion_code("DUCK001")

    @patch("services.promotion_service.finalize_promotion_code")
    @patch("services.promotion_service.finalize_promotion_redemption")
    @patch("services.promotion_service.update_player_document")
    @patch("services.promotion_service.claim_promotion_code")
    @patch("services.promotion_service.create_or_get_promotion_redemption")
    @patch("services.promotion_service.promotion_redemption_for_player", return_value=None)
    @patch("services.promotion_service.find_promotion_code")
    def test_valid_redemption_grants_server_configured_reward_once(self, find_code, _prior, create, claim, update, finalize_redemption, finalize_code):
        find_code.return_value = {"duck_number": "037", "code_hash": HASH, "status": "AVAILABLE"}
        create.return_value = {"redemption_id": "pr_one", "code_hash": HASH, "duck_number": "037", "status": "PENDING"}
        claim.return_value = {"status": "CLAIMED"}; update.return_value = {"coins": 1200}
        result = redeem_cruise_duck(PLAYER, CODE)
        self.assertEqual(result["status"], "REDEEMED"); self.assertEqual(result["reward"], {"type": "coins", "value": 500}); self.assertEqual(result["new_coins"], 1200)
        update.assert_called_once(); self.assertEqual(update.call_args.args[1]["$inc"], {"coins": 500})
        finalize_redemption.assert_called_once(); finalize_code.assert_called_once()

    @patch("services.promotion_service.find_internal_player", return_value={"device_id": "private-device", "coins": 1200})
    @patch("services.promotion_service.create_or_get_promotion_redemption")
    @patch("services.promotion_service.promotion_redemption_for_player")
    @patch("services.promotion_service.find_promotion_code", return_value={"duck_number": "037", "code_hash": HASH})
    def test_response_loss_retry_is_idempotent(self, _code, prior, create, _player):
        record = {"redemption_id": "pr_one", "code_hash": HASH, "duck_number": "037", "status": "REDEEMED"}
        prior.return_value = record; create.return_value = record
        result = redeem_cruise_duck(PLAYER, CODE)
        self.assertEqual(result["status"], "ALREADY_REDEEMED"); self.assertEqual(result["new_coins"], 1200)

    @patch("services.promotion_service.promotion_redemption_for_player")
    @patch("services.promotion_service.find_promotion_code", return_value={"duck_number": "038", "code_hash": HASH})
    def test_one_campaign_redemption_per_player(self, _code, prior):
        prior.return_value = {"code_hash": "another-hash"}
        with self.assertRaises(PromotionError) as context: redeem_cruise_duck(PLAYER, CODE)
        self.assertEqual(context.exception.code, "PROMO_PLAYER_LIMIT")

    @patch("services.promotion_service.find_promotion_code", return_value=None)
    def test_invalid_code_fails_without_reward(self, _find):
        with self.assertRaises(PromotionError) as context: redeem_cruise_duck(PLAYER, CODE)
        self.assertEqual(context.exception.code, "PROMO_INVALID")

    @patch("services.promotion_service.claim_promotion_code", return_value=None)
    @patch("services.promotion_service.discard_pending_promotion_redemption")
    @patch("services.promotion_service.create_or_get_promotion_redemption")
    @patch("services.promotion_service.promotion_redemption_for_player", return_value=None)
    @patch("services.promotion_service.find_promotion_code", return_value={"duck_number": "037", "code_hash": HASH})
    def test_globally_claimed_code_cannot_double_grant(self, _code, _prior, create, discard, _claim):
        create.return_value = {"redemption_id": "pr_loser", "code_hash": HASH, "duck_number": "037", "status": "PENDING"}
        with self.assertRaises(PromotionError) as context: redeem_cruise_duck(PLAYER, CODE)
        self.assertEqual(context.exception.code, "PROMO_ALREADY_REDEEMED")
        discard.assert_called_once_with("pr_loser")

    def test_endpoint_and_database_contract_exclude_client_reward_authority(self):
        root = Path(__file__).resolve().parents[1]
        server = (root / "server.py").read_text(); models = (root / "models.py").read_text(); database = (root / "database.py").read_text()
        self.assertIn('rate_limit("promotion-redeem", requests=8, window_seconds=60)', server)
        self.assertEqual(server.count('@app.post("/api/promotions/redeem"'), 1)
        self.assertEqual(server.count("from services.promotion_service import PromotionError, redeem_cruise_duck"), 1)
        self.assertIn('authenticated_bearer_player(authorization)', server)
        request = models[models.index("class PromotionRedemptionRequest"):models.index("class Player(")]
        self.assertIn("code:", request); self.assertNotIn("reward", request); self.assertNotIn("device_id", request)
        self.assertIn('name="promotion_code_hash_unique"', database); self.assertIn('name="promotion_player_campaign_unique"', database)

    def test_provisioning_uses_cryptographic_random_codes_and_hash_only_server_records(self):
        source = (Path(__file__).resolve().parents[1] / "scripts" / "provision_cruise_ducks.py").read_text()
        self.assertIn("secrets.token_hex(12)", source); self.assertIn("hashlib.sha256", source)
        server_insert = source[source.index("collection.insert_many"):]
        self.assertIn('"code_hash"', server_insert); self.assertNotIn('"redemption_code":', server_insert)

if __name__ == "__main__": unittest.main()
