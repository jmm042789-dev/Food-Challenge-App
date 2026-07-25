"""Isolated guest-account deletion tests; no external service is used."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import auth
import database
import server
from models import AccountDeletionRequest
from rate_limit import InMemoryRateLimiter, RateLimit


class _DeleteResult:
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


class _PlayerCollection:
    def __init__(self, documents):
        self.documents = [dict(document) for document in documents]

    def find_one(self, query):
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                return dict(document)
        return None

    def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if all(document.get(key) == value for key, value in query.items()):
                self.documents.pop(index)
                return _DeleteResult(1)
        return _DeleteResult(0)


class AccountDeletionTests(unittest.TestCase):
    def setUp(self):
        self.player_a_token = "player-a-token"
        self.player_b_token = "player-b-token"
        self.player_a = {
            "device_id": "guest_a",
            "player_id": "guest_a",
            "auth_token_hash": auth.hash_auth_token(self.player_a_token),
            "installation_id_hash": "installation-a",
            "username": "Player A",
            "best_score": 100,
            "active_match": {"id": "persistent-a"},
            "owned_gear": ["gear-a"],
            "welcome_reward_claimed": True,
        }
        self.player_b = {
            "device_id": "guest_b",
            "player_id": "guest_b",
            "auth_token_hash": auth.hash_auth_token(self.player_b_token),
            "installation_id_hash": "installation-b",
            "username": "Player B",
            "best_score": 90,
        }

    def test_confirmation_is_required_fixed_and_strict(self):
        with self.assertRaises(ValidationError):
            AccountDeletionRequest()
        with self.assertRaises(ValidationError):
            AccountDeletionRequest(confirmation="delete")
        with self.assertRaises(ValidationError):
            AccountDeletionRequest(confirmation="DELETE", player_id="guest_b")

    def test_missing_authentication_returns_generic_401(self):
        with self.assertRaises(HTTPException) as raised:
            server.delete_player_account_endpoint(
                AccountDeletionRequest(confirmation="DELETE"),
                None,
            )
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, auth.AUTHENTICATION_ERROR)

    def test_invalid_token_returns_generic_401(self):
        with (
            patch.object(auth, "find_internal_player_by_auth_hash", return_value=None),
            self.assertRaises(HTTPException) as raised,
        ):
            server.delete_player_account_endpoint(
                AccountDeletionRequest(confirmation="DELETE"),
                "Bearer invalid-token",
            )
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, auth.AUTHENTICATION_ERROR)

    def test_authenticated_deletion_removes_all_player_data_and_ephemeral_state(self):
        collection = _PlayerCollection([self.player_a, self.player_b])
        database.queue[:] = [
            {"device_id": "guest_a"},
            {"device_id": "guest_b"},
        ]
        database.active_matches.clear()
        database.active_matches.update(
            {
                "match-a": {"players": ["guest_a", "guest_bot"]},
                "match-b": {"players": ["guest_b", "guest_bot"]},
            }
        )

        with (
            patch.object(database, "player_collection", collection),
            patch.object(
                auth,
                "find_internal_player_by_auth_hash",
                side_effect=lambda token_hash: collection.find_one(
                    {"auth_token_hash": token_hash}
                ),
            ),
            patch.object(server, "delete_guest_player", database.delete_guest_player),
        ):
            response = server.delete_player_account_endpoint(
                AccountDeletionRequest(confirmation="DELETE"),
                f"Bearer {self.player_a_token}",
            )

            self.assertEqual(response, {"deleted": True})
            self.assertNotIn("deleted_count", response)
            self.assertNotIn("auth_token_hash", response)
            self.assertIsNone(collection.find_one({"device_id": "guest_a"}))
            self.assertIsNotNone(collection.find_one({"device_id": "guest_b"}))
            self.assertEqual(database.queue, [{"device_id": "guest_b"}])
            self.assertNotIn("match-a", database.active_matches)
            self.assertIn("match-b", database.active_matches)

            # Leaderboard is a live player projection, so the deleted document
            # and all profile/score fields disappear together.
            self.assertNotIn(
                "guest_a",
                [document["device_id"] for document in collection.documents],
            )

            with self.assertRaises(HTTPException) as repeated:
                auth.authenticated_bearer_player(f"Bearer {self.player_a_token}")
            self.assertEqual(repeated.exception.status_code, 401)
            self.assertEqual(repeated.exception.detail, auth.AUTHENTICATION_ERROR)

    def test_bearer_token_cannot_select_another_player_for_deletion(self):
        collection = _PlayerCollection([self.player_a, self.player_b])
        with (
            patch.object(database, "player_collection", collection),
            patch.object(
                auth,
                "find_internal_player_by_auth_hash",
                side_effect=lambda token_hash: collection.find_one(
                    {"auth_token_hash": token_hash}
                ),
            ),
            patch.object(server, "delete_guest_player", database.delete_guest_player),
        ):
            server.delete_player_account_endpoint(
                AccountDeletionRequest(confirmation="DELETE"),
                f"Bearer {self.player_a_token}",
            )
        self.assertIsNone(collection.find_one({"device_id": "guest_a"}))
        self.assertIsNotNone(collection.find_one({"device_id": "guest_b"}))

    def test_deletion_rate_limit_returns_generic_429(self):
        limiter = InMemoryRateLimiter()
        limit = RateLimit(requests=3, window_seconds=3600)
        for current in range(3):
            limiter.check("account-deletion:client", limit, now=float(current))
        with self.assertRaises(HTTPException) as raised:
            limiter.check("account-deletion:client", limit, now=4)
        self.assertEqual(raised.exception.status_code, 429)
        self.assertEqual(raised.exception.detail, "too many requests")

    def test_deletion_route_has_rate_limit_dependency(self):
        route = next(
            route
            for route in server.app.routes
            if getattr(route, "path", None) == "/api/player/account"
            and "DELETE" in getattr(route, "methods", set())
        )
        self.assertTrue(route.dependant.dependencies)


if __name__ == "__main__":
    unittest.main()
