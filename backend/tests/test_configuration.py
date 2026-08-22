"""Isolated configuration and lifecycle tests; no external database is used."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import database
import server
from config import BackendConfig, ConfigurationError, load_config


VALID_VALUES = {
    "FIRE_FEAST_ENV": "test",
    "MONGO_URL": "mongodb://database.example:27017",
    "DB_NAME": "fire_feast_test",
    "FIRE_FEAST_CORS_ORIGINS": "",
}


class _Admin:
    def __init__(self):
        self.commands = []

    def command(self, command, **options):
        self.commands.append((command, options))
        return {"ok": 1}


class _Collection:
    def __init__(self):
        self.indexes = []
        self.updates = []

    def create_index(self, fields, **options):
        self.indexes.append((fields, options))

    def update_one(self, query, update, **options):
        self.updates.append((query, update, options))


class _Database:
    def __init__(self):
        self.collections = {
            "players": _Collection(),
            "settings": _Collection(),
        }

    def __getitem__(self, name):
        return self.collections[name]


class _MongoClient:
    def __init__(self):
        self.admin = _Admin()
        self.databases = {}
        self.closed = False

    def __getitem__(self, name):
        self.databases.setdefault(name, _Database())
        return self.databases[name]

    def close(self):
        self.closed = True


class ConfigurationTests(unittest.TestCase):
    def tearDown(self):
        database.close_database()

    def test_required_environment_variables_are_enforced(self):
        for key in ("FIRE_FEAST_ENV", "MONGO_URL", "DB_NAME"):
            values = dict(VALID_VALUES)
            values.pop(key)
            with self.subTest(key=key), self.assertRaises(ConfigurationError):
                load_config(values)

    def test_valid_configuration_is_normalized(self):
        values = dict(VALID_VALUES)
        values["FIRE_FEAST_CORS_ORIGINS"] = (
            " https://app.example.com/,https://admin.example.com "
        )
        config = load_config(values)
        self.assertEqual(config.environment, "test")
        self.assertEqual(config.db_name, "fire_feast_test")
        self.assertEqual(
            config.cors_origins,
            ("https://app.example.com", "https://admin.example.com"),
        )
        self.assertEqual(config.guest_recovery_window_seconds, 600)

    def test_guest_recovery_window_is_configurable_and_bounded(self):
        configured = load_config(
            dict(VALID_VALUES, FIRE_FEAST_GUEST_RECOVERY_WINDOW_SECONDS="900")
        )
        self.assertEqual(configured.guest_recovery_window_seconds, 900)
        for invalid in ("59", "3601", "not-a-number"):
            with self.subTest(invalid=invalid), self.assertRaises(ConfigurationError):
                load_config(
                    dict(
                        VALID_VALUES,
                        FIRE_FEAST_GUEST_RECOVERY_WINDOW_SECONDS=invalid,
                    )
                )

    def test_production_rejects_loopback_mongo_and_insecure_cors(self):
        loopback = dict(VALID_VALUES, FIRE_FEAST_ENV="production")
        loopback["MONGO_URL"] = "mongodb://127.0.0.1:27017"
        with self.assertRaises(ConfigurationError):
            load_config(loopback)

        insecure_cors = dict(VALID_VALUES, FIRE_FEAST_ENV="production")
        insecure_cors["FIRE_FEAST_CORS_ORIGINS"] = "http://app.example.com"
        with self.assertRaises(ConfigurationError):
            load_config(insecure_cors)

    def test_database_initialization_pings_and_creates_required_indexes(self):
        client = _MongoClient()
        config = BackendConfig(
            environment="test",
            mongo_url=VALID_VALUES["MONGO_URL"],
            db_name=VALID_VALUES["DB_NAME"],
            cors_origins=(),
        )
        with patch.object(database, "MongoClient", return_value=client):
            database.initialize_database(config)

        self.assertEqual(client.admin.commands, [("ping", {})])
        players = client.databases[config.db_name].collections["players"]
        self.assertEqual(
            {options["name"] for _fields, options in players.indexes},
            {
                "player_device_id_unique",
                "player_id_unique",
                "player_installation_unique",
                "player_auth_token_unique",
                "player_public_id_unique",
                "player_public_handle_unique",
                "player_contest_best_lookup",
            },
        )
        settings = client.databases[config.db_name].collections["settings"]
        self.assertEqual(len(settings.updates), 1)

    def test_startup_validates_configuration_before_database(self):
        with (
            patch.object(
                server,
                "load_config",
                side_effect=ConfigurationError("required variable is missing"),
            ),
            patch.object(server, "initialize_database") as initialize,
            self.assertRaises(RuntimeError),
        ):
            server.startup_database()
        initialize.assert_not_called()

    def test_successful_startup_and_shutdown_delegate_to_database_lifecycle(self):
        config = load_config(VALID_VALUES)
        with (
            patch.object(server, "load_config", return_value=config),
            patch.object(server, "initialize_database") as initialize,
            patch.object(server, "close_database") as close,
        ):
            server.startup_database()
            server.shutdown_database()
        initialize.assert_called_once_with(config)
        close.assert_called_once_with()

    def test_database_startup_failure_is_sanitized_and_closed(self):
        config = load_config(VALID_VALUES)
        with (
            patch.object(server, "load_config", return_value=config),
            patch.object(
                server,
                "initialize_database",
                side_effect=RuntimeError("secret-bearing database error"),
            ),
            patch.object(server, "close_database") as close,
            self.assertRaisesRegex(RuntimeError, "database startup validation failed"),
        ):
            server.startup_database()
        close.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
