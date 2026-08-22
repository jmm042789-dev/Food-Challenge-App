"""Isolated guest-authentication tests; no external service or MongoDB is used."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import auth
import database
import server
from config import DEFAULT_STARTING_COINS
from models import MatchResult, MatchStart, PurchaseRequest
from services import leaderboard_service, player_service


class GuestAuthenticationTests(unittest.TestCase):
    def test_new_player_receives_token_and_backend_document_stores_only_hash(self):
        captured = {}

        def capture(document):
            captured.update(document)
            return database.public_player_document(document)

        with (
            patch.object(player_service, "installation_has_guest", return_value=False),
            patch.object(player_service, "create_guest_player", side_effect=capture),
        ):
            response = player_service.bootstrap_guest(
                "installation_" + "a" * 32,
                "recovery_" + "r" * 32,
            )

        self.assertTrue(response["auth_token"])
        self.assertEqual(response["player_id"], response["player"]["player_id"])
        self.assertEqual(response["player"]["coins"], DEFAULT_STARTING_COINS)
        self.assertEqual(captured["coins"], DEFAULT_STARTING_COINS)
        self.assertNotIn("auth_token", response["player"])
        self.assertNotIn("auth_token_hash", response["player"])
        self.assertNotIn("auth_token", captured)
        self.assertEqual(
            captured["auth_token_hash"],
            auth.hash_auth_token(response["auth_token"]),
        )
        self.assertNotEqual(captured["auth_token_hash"], response["auth_token"])

    def test_bootstrap_token_verifies_in_a_separate_authentication_context(self):
        """Models two Render workers sharing only the persisted player document."""
        persisted = {}

        def insert(document):
            persisted.update(document)
            return database.public_player_document(document)

        with (
            patch.object(player_service, "installation_has_guest", return_value=False),
            patch.object(player_service, "create_guest_player", side_effect=insert),
        ):
            bootstrap = player_service.bootstrap_guest(
                "installation_" + "m" * 32,
                "recovery_" + "n" * 32,
            )

        with patch.object(
            auth,
            "find_internal_player_by_auth_hash",
            return_value=dict(persisted),
        ):
            authenticated = auth.authenticated_bearer_player(
                f"Bearer {bootstrap['auth_token']}"
            )

        self.assertEqual(authenticated["player_id"], bootstrap["player_id"])
        self.assertEqual(
            authenticated["auth_token_hash"],
            auth.hash_auth_token(bootstrap["auth_token"]),
        )

    def test_token_not_returned_by_ordinary_profile_sanitization(self):
        profile = database.public_player_document(
            {
                "player_id": "guest_public",
                "device_id": "guest_public",
                "auth_token_hash": "secret hash",
                "installation_id_hash": "installation hash",
                "token_created_at": "now",
                "token_version": 1,
                "coins": 5,
            }
        )
        self.assertEqual(profile["player_id"], "guest_public")
        self.assertNotIn("auth_token_hash", profile)
        self.assertNotIn("installation_id_hash", profile)
        self.assertNotIn("token_created_at", profile)
        self.assertNotIn("token_version", profile)
        self.assertNotIn("bootstrap_recovery_nonce_hash", profile)
        self.assertNotIn("bootstrap_recovery_expires_at", profile)

    def test_missing_token_returns_401(self):
        with self.assertRaises(HTTPException) as raised:
            auth.authenticated_player("guest_a", None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_wrong_token_returns_401(self):
        player = {
            "player_id": "guest_a",
            "auth_token_hash": auth.hash_auth_token("correct-token"),
        }
        with (
            patch.object(auth, "find_internal_player", return_value=player),
            self.assertRaises(HTTPException) as raised,
        ):
            auth.authenticated_player("guest_a", "Bearer wrong-token")
        self.assertEqual(raised.exception.status_code, 401)

    def test_correct_token_succeeds(self):
        player = {
            "player_id": "guest_a",
            "auth_token_hash": auth.hash_auth_token("correct-token"),
        }
        with patch.object(auth, "find_internal_player", return_value=player):
            result = auth.authenticated_player(
                "guest_a",
                "Bearer correct-token",
            )
        self.assertIs(result, player)

    def test_bearer_session_resolves_authoritative_player_id_without_exposing_token(self):
        player = {
            "device_id": "guest_a",
            "player_id": "guest_a",
            "auth_token_hash": auth.hash_auth_token("correct-token"),
            "token_version": auth.AUTH_TOKEN_VERSION,
            "coins": 500,
        }
        with patch.object(server, "authenticated_bearer_player", return_value=player):
            result = server.guest_session_endpoint("Bearer correct-token")

        self.assertEqual(result["player_id"], "guest_a")
        self.assertEqual(result["player"]["player_id"], "guest_a")
        self.assertEqual(result["token_type"], "opaque")
        self.assertEqual(result["token_version"], auth.AUTH_TOKEN_VERSION)
        self.assertNotIn("auth_token", result)
        self.assertNotIn("auth_token_hash", result["player"])

    def test_bearer_session_requires_authentication(self):
        with self.assertRaises(HTTPException) as raised:
            server.guest_session_endpoint(None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_player_a_token_cannot_authorize_player_b(self):
        player_b = {
            "player_id": "guest_b",
            "auth_token_hash": auth.hash_auth_token("player-b-token"),
        }
        with (
            patch.object(auth, "find_internal_player", return_value=player_b),
            self.assertRaises(HTTPException) as raised,
        ):
            auth.authenticated_player("guest_b", "Bearer player-a-token")
        self.assertEqual(raised.exception.status_code, 401)

    def test_leaderboard_never_exposes_credentials_or_player_id(self):
        with patch.object(
            leaderboard_service,
            "leaderboard_players",
            return_value=[
                {
                    "device_id": "legacy-public-id",
                    "player_id": "guest_public",
                    "auth_token_hash": "hash",
                    "username": "Player",
                    "best_score": 10,
                    "xp": 0,
                }
            ],
        ):
            entry = leaderboard_service.get_leaderboard({"public_id": "viewer", "public_handle": "viewer", "public_handle_normalized": "viewer"})["leaderboard"][0]
        self.assertNotIn("device_id", entry)
        self.assertNotIn("player_id", entry)
        self.assertNotIn("auth_token", entry)
        self.assertNotIn("auth_token_hash", entry)

    def test_duplicate_bootstrap_does_not_create_or_reissue_credentials(self):
        with (
            patch.object(player_service, "installation_has_guest", return_value=True),
            patch.object(player_service, "create_guest_player") as create,
            self.assertRaises(player_service.BootstrapAlreadyCompletedError),
        ):
            player_service.bootstrap_guest(
                "installation_" + "b" * 32,
                "recovery_" + "r" * 32,
            )
        create.assert_not_called()

    def test_legacy_public_id_alone_cannot_migrate_or_authenticate(self):
        legacy = {"device_id": "public-legacy-id", "coins": 500}
        with (
            patch.object(auth, "find_internal_player", return_value=legacy),
            self.assertRaises(HTTPException) as raised,
        ):
            auth.authenticated_player(
                "public-legacy-id",
                "Bearer public-legacy-id",
            )
        self.assertEqual(raised.exception.status_code, 401)

    def test_purchase_match_start_and_match_result_require_authentication(self):
        protected_calls = [
            lambda: server.purchase_endpoint(
                PurchaseRequest(device_id="guest_a", item_id="antacid_pack"),
                None,
            ),
            lambda: server.match_start_endpoint(
                MatchStart(device_id="guest_a", contest_id="nathans-hotdogs"),
                None,
            ),
            lambda: server.match_result(
                MatchResult(
                    device_id="guest_a",
                    match_id="match-a",
                    contest_id="nathans-hotdogs",
                    opponent_id="ai-1",
                    score=1,
                    opponent_score=0,
                    duration_sec=1,
                    accepted_taps=1,
                    completed_progress=1,
                    maximum_combo=0,
                    validation_version=2,
                    input_events=[],
                ),
                None,
            ),
        ]
        for call in protected_calls:
            with self.subTest(call=call), self.assertRaises(HTTPException) as raised:
                call()
            self.assertEqual(raised.exception.status_code, 401)

    def test_protected_endpoint_with_validated_credentials_succeeds(self):
        expected = {"ok": True, "new_coins": 10}
        with (
            patch.object(server, "authenticated_player", return_value={"player_id": "guest_a"}),
            patch.object(server, "purchase_item", return_value=expected),
        ):
            result = server.purchase_endpoint(
                PurchaseRequest(device_id="guest_a", item_id="antacid_pack"),
                "Bearer correct-token",
            )
        self.assertEqual(result, expected)


if __name__ == "__main__":
    unittest.main()
