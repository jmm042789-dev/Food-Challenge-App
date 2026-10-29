"""Staging isolation regressions; synthetic settings, no external services."""
import os
from pathlib import Path
import runpy
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import ConfigurationError, load_config

VALID = {
    "FIRE_FEAST_DEPLOYMENT": "staging", "FIRE_FEAST_ENV": "production",
    "PYTHON_DOTENV_DISABLED": "1", "DB_NAME": "fire_feast_staging",
    "STAGING_MONGO_HOST": "database-test.invalid",
    "STAGING_MONGO_URL": "mongodb+srv://synthetic:synthetic@database-test.invalid/fire_feast_staging?retryWrites=true&w=majority",
}

class StagingConfigurationTests(unittest.TestCase):
    def test_dedicated_settings_ignore_generic_database_uri(self):
        config = load_config(dict(VALID, MONGO_URL="mongodb://unrelated-test.invalid/other"))
        self.assertEqual(config.mongo_url, VALID["STAGING_MONGO_URL"])
        self.assertEqual(config.db_name, "fire_feast_staging")
        self.assertTrue(config.is_production)

    def test_missing_staging_values_never_use_generic_or_import_fallbacks(self):
        for key in ("STAGING_MONGO_URL", "STAGING_MONGO_HOST", "DB_NAME", "PYTHON_DOTENV_DISABLED"):
            values = dict(VALID, MONGO_URL=VALID["STAGING_MONGO_URL"])
            values.pop(key)
            for required in (True, False):
                with self.subTest(key=key, required=required), self.assertRaises(ConfigurationError):
                    load_config(values, require_database=required)

    def test_wrong_environment_or_database_is_rejected(self):
        for key, value in (("DB_NAME", "other_database"), ("FIRE_FEAST_ENV", "preview"), ("PYTHON_DOTENV_DISABLED", "0")):
            with self.subTest(key=key), self.assertRaises(ConfigurationError):
                load_config(dict(VALID, **{key: value}))

    def test_wrong_host_path_credentials_and_insecure_options_are_rejected(self):
        uri = VALID["STAGING_MONGO_URL"]
        invalid = [
            "bad-uri", uri.replace("database-test.invalid", "wrong-test.invalid"),
            uri.replace("fire_feast_staging", "other_database"),
            uri.replace("synthetic:synthetic@", ""), uri.replace("mongodb+srv", "mongodb"),
            uri + "&tls=false", uri + "&tlsAllowInvalidCertificates=true",
            uri + "&tlsInsecure=true", uri + "&ssl=false", uri + "&tls=true&TLS=false",
            uri + "#fragment", uri.replace("database-test.invalid", "database-test.invalid:27017"),
        ]
        for value in invalid:
            with self.subTest(case=invalid.index(value)), self.assertRaises(ConfigurationError):
                load_config(dict(VALID, STAGING_MONGO_URL=value))

    def test_configuration_errors_do_not_expose_credentials(self):
        with self.assertRaises(ConfigurationError) as caught:
            load_config(dict(VALID, STAGING_MONGO_URL="mongodb+srv://private-user:private-secret@wrong-test.invalid/other"))
        self.assertNotIn("private-user", str(caught.exception))
        self.assertNotIn("private-secret", str(caught.exception))

    def test_staging_module_import_never_loads_dotenv(self):
        with patch.dict(os.environ, {"FIRE_FEAST_DEPLOYMENT": "staging"}, clear=True), patch("dotenv.load_dotenv") as load:
            runpy.run_path(str(Path(__file__).resolve().parents[1] / "config.py"))
        load.assert_not_called()
