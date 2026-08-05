"""Tests for deterministic and opt-in repository validation gates."""

import os
import subprocess
import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_ROOT.parent
INTEGRATION_FILES = {
    "test_authenticated_integration.py",
    "test_chomp_champs.py",
    "test_new_features.py",
}
VALIDATION_TEST_FILE = Path(__file__).name


class ValidationGateTests(unittest.TestCase):
    def test_deterministic_modules_do_not_reference_live_backend_configuration(self):
        for test_file in (BACKEND_ROOT / "tests").glob("test_*.py"):
            if test_file.name in INTEGRATION_FILES or test_file.name == VALIDATION_TEST_FILE:
                continue
            with self.subTest(test_file=test_file.name):
                source = test_file.read_text(encoding="utf-8")
                self.assertNotIn("EXPO_PUBLIC_BACKEND_URL", source)
                self.assertNotIn("FIRE_FEAST_INTEGRATION_AUTH_TOKEN", source)

    def test_integration_modules_import_and_skip_without_configuration(self):
        environment = os.environ.copy()
        for name in (
            "EXPO_PUBLIC_BACKEND_URL",
            "FIRE_FEAST_INTEGRATION_AUTH_TOKEN",
            "FIRE_FEAST_RUN_INTEGRATION",
        ):
            environment.pop(name, None)
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "pytest",
                "backend/tests/test_authenticated_integration.py",
                "backend/tests/test_chomp_champs.py",
                "backend/tests/test_new_features.py",
                "-q",
            ],
            cwd=REPOSITORY_ROOT,
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertIn("skipped", output.lower())

    def test_validation_stage_runner_reports_success_and_failure_exit_codes(self):
        common = REPOSITORY_ROOT / "scripts" / "validation-common.ps1"
        escaped = str(common).replace("'", "''")
        command = (
            f". '{escaped}'; "
            "$pass = Invoke-ValidationStage 'pass probe' { & cmd /c exit 0 }; "
            "$fail = Invoke-ValidationStage 'fail probe' { & cmd /c exit 7 }; "
            "if ($pass -and -not $fail) { exit 0 } else { exit 1 }"
        )
        result = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                command,
            ],
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertIn("[pass probe] PASS", output)
        self.assertIn("[fail probe] FAIL (exit 7)", output)

    def test_integration_script_skips_with_success_exit_code_when_unconfigured(self):
        environment = os.environ.copy()
        for name in (
            "EXPO_PUBLIC_BACKEND_URL",
            "FIRE_FEAST_INTEGRATION_AUTH_TOKEN",
            "FIRE_FEAST_RUN_INTEGRATION",
        ):
            environment.pop(name, None)
        result = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(REPOSITORY_ROOT / "scripts" / "validate-integration.ps1"),
            ],
            cwd=REPOSITORY_ROOT,
            env=environment,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertIn("SKIPPED", output)


if __name__ == "__main__":
    unittest.main()
