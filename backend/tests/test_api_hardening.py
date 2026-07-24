"""Isolated application-layer hardening tests; no database is used."""

import sys
import unittest
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models import MatchResult, PlayerCreate, PlayerProfileUpdate
from rate_limit import InMemoryRateLimiter, RateLimit
import server
import auth


class ApiHardeningTests(unittest.TestCase):
    def test_rate_limit_rejects_only_after_configured_allowance(self):
        limiter = InMemoryRateLimiter()
        limit = RateLimit(requests=2, window_seconds=60)
        limiter.check("route:client", limit, now=1)
        limiter.check("route:client", limit, now=2)
        with self.assertRaises(HTTPException) as raised:
            limiter.check("route:client", limit, now=3)
        self.assertEqual(raised.exception.status_code, 429)
        self.assertEqual(raised.exception.detail, "too many requests")

    def test_rate_limit_isolated_by_client_key(self):
        limiter = InMemoryRateLimiter()
        limit = RateLimit(requests=1, window_seconds=60)
        limiter.check("route:client-a", limit, now=1)
        limiter.check("route:client-b", limit, now=1)

    def test_rate_limit_window_expires(self):
        limiter = InMemoryRateLimiter()
        limit = RateLimit(requests=1, window_seconds=10)
        limiter.check("route:client", limit, now=1)
        limiter.check("route:client", limit, now=11)

    def test_identifiers_are_bounded_and_reject_control_characters(self):
        with self.assertRaises(ValidationError):
            PlayerCreate(device_id="x" * 129)
        with self.assertRaises(ValidationError):
            PlayerCreate(device_id="guest\nforged")

    def test_profile_text_is_trimmed_and_rejects_controls(self):
        self.assertEqual(
            PlayerProfileUpdate(username="  Hungry Hero  ").username,
            "Hungry Hero",
        )
        with self.assertRaises(ValidationError):
            PlayerProfileUpdate(username="Hero\nforged log")
        with self.assertRaises(ValidationError):
            PlayerProfileUpdate(username="   ")

    def test_match_numbers_have_upper_bounds(self):
        with self.assertRaises(ValidationError):
            MatchResult(
                device_id="guest_a",
                contest_id="contest-a",
                opponent_id="opponent-a",
                score=10_000_001,
                duration_sec=1,
            )

    def test_unexpected_request_fields_are_rejected(self):
        with self.assertRaises(ValidationError):
            PlayerCreate(device_id="guest_a", auth_token="must-not-be-accepted")

    def test_oversized_authentication_inputs_fail_before_database_lookup(self):
        with self.assertRaises(HTTPException) as token_error:
            auth.authenticate_bearer("Bearer " + "x" * 513)
        self.assertEqual(token_error.exception.status_code, 401)

        with self.assertRaises(HTTPException) as player_error:
            auth.authenticated_player("x" * 129, "Bearer harmless-token")
        self.assertEqual(player_error.exception.status_code, 401)

    def test_sensitive_routes_have_rate_limit_dependencies(self):
        protected_paths = {
            "/api/auth/guest",
            "/api/player/tutorial_done",
            "/api/player/welcome_reward",
            "/api/matchmaking/join",
            "/api/match/start",
            "/api/match/result",
            "/api/purchase",
        }
        routes = {
            route.path: route
            for route in server.app.routes
            if getattr(route, "path", None) in protected_paths
        }
        self.assertEqual(set(routes), protected_paths)
        for path, route in routes.items():
            with self.subTest(path=path):
                self.assertTrue(route.dependant.dependencies)


if __name__ == "__main__":
    unittest.main()
