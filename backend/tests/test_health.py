"""Deterministic liveness and MongoDB readiness tests."""

import json
import logging
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import database
import server


class _Admin:
    def __init__(self, error=None):
        self.error = error
        self.commands = []

    def command(self, command, **options):
        self.commands.append((command, options))
        if self.error:
            raise self.error
        return {"ok": 1}


class _Client:
    def __init__(self, error=None):
        self.admin = _Admin(error)


def _json_body(response):
    return json.loads(response.body.decode("utf-8"))


class HealthEndpointTests(unittest.TestCase):
    def tearDown(self):
        database.mongo_client = None

    def test_liveness_returns_200_when_database_is_available(self):
        database.mongo_client = _Client()
        self.assertEqual(
            server.health_live(),
            {"status": "alive", "service": "fire-feast-api"},
        )

    def test_liveness_returns_200_when_database_is_unavailable(self):
        database.mongo_client = None
        self.assertEqual(server.health_live()["status"], "alive")

    def test_readiness_returns_200_after_read_only_bounded_ping(self):
        client = _Client()
        database.mongo_client = client
        self.assertEqual(server.health_ready(), {"status": "ready"})
        self.assertEqual(
            client.admin.commands,
            [("ping", {"maxTimeMS": database.DATABASE_READINESS_TIMEOUT_MS})],
        )

    def test_readiness_returns_503_when_client_is_unavailable(self):
        database.mongo_client = None
        response = server.health_ready()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(_json_body(response), {"status": "unavailable"})

    def test_readiness_returns_503_when_ping_throws_without_leaking_details(self):
        secret = "mongodb://user:password@secret-host/private_database"
        database.mongo_client = _Client(RuntimeError(secret))
        with self.assertLogs(server.logger, level=logging.WARNING) as captured:
            response = server.health_ready()
        response_text = response.body.decode("utf-8")
        log_text = " ".join(captured.output)
        self.assertEqual(response.status_code, 503)
        for sensitive in (secret, "password", "private_database", "secret-host"):
            self.assertNotIn(sensitive, response_text)
            self.assertNotIn(sensitive, log_text)
        self.assertIn("category=driver_error", log_text)
        self.assertIn("exception=RuntimeError", log_text)
        self.assertIn("endpoint=/api/health/ready", log_text)

    def test_readiness_returns_503_on_timeout(self):
        database.mongo_client = _Client(TimeoutError("mongodb://secret"))
        response = server.health_ready()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(_json_body(response), {"status": "unavailable"})
        self.assertEqual(database.database_readiness().category, "timeout")

    def test_compatibility_health_uses_readiness_semantics(self):
        database.mongo_client = _Client()
        self.assertEqual(server.health(), {"status": "ok"})
        database.mongo_client = None
        response = server.health()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(_json_body(response), {"status": "unavailable"})

    def test_readiness_does_not_access_application_collections(self):
        client = _Client()
        database.mongo_client = client
        with (
            patch.object(database, "player_collection") as players,
            patch.object(database, "settings_collection") as settings,
        ):
            result = database.database_readiness()
        self.assertTrue(result.ready)
        self.assertEqual(players.mock_calls, [])
        self.assertEqual(settings.mock_calls, [])

    def test_render_uses_readiness_endpoint(self):
        descriptor = (REPOSITORY_ROOT / "render.yaml").read_text(encoding="utf-8")
        self.assertIn("healthCheckPath: /api/health/ready", descriptor)
        self.assertNotIn("healthCheckPath: /api/health\n", descriptor)


if __name__ == "__main__":
    unittest.main()
