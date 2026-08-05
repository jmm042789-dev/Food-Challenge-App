"""Focused recoverable guest-bootstrap tests with atomic in-memory persistence."""

import copy
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import auth
import database
from services import player_service


INSTALLATION_ID = "installation_" + "a" * 32
RECOVERY_NONCE = "recovery_" + "b" * 32
INITIAL_TIME = datetime(2026, 8, 4, 12, 0, tzinfo=timezone.utc)


class AtomicGuestStore:
    def __init__(self):
        self.document = None
        self.lock = threading.Lock()

    def installation_has_guest(self, installation_hash):
        with self.lock:
            return bool(
                self.document
                and self.document.get("installation_id_hash") == installation_hash
            )

    def create(self, document):
        with self.lock:
            if self.document is not None:
                return None
            self.document = copy.deepcopy(document)
            return database.public_player_document(self.document)

    def find_by_installation(self, installation_hash):
        with self.lock:
            if not self.document or self.document["installation_id_hash"] != installation_hash:
                return None
            return copy.deepcopy(self.document)

    def recover(self, installation_hash, nonce_hash, current_time, token_hash, created_at):
        with self.lock:
            document = self.document
            if (
                not document
                or document.get("installation_id_hash") != installation_hash
                or document.get("bootstrap_recovery_nonce_hash") != nonce_hash
                or document.get("bootstrap_recovery_expires_at", "") <= current_time
            ):
                return None
            document["auth_token_hash"] = token_hash
            document["token_created_at"] = created_at
            document["token_version"] = int(document.get("token_version", 0)) + 1
            document.pop("bootstrap_recovery_nonce_hash", None)
            document.pop("bootstrap_recovery_expires_at", None)
            return copy.deepcopy(document)

    def complete(self, device_id, token_hash):
        with self.lock:
            if (
                not self.document
                or self.document.get("device_id") != device_id
                or self.document.get("auth_token_hash") != token_hash
            ):
                return None
            self.document.pop("bootstrap_recovery_nonce_hash", None)
            self.document.pop("bootstrap_recovery_expires_at", None)
            return copy.deepcopy(self.document)


class GuestBootstrapRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.store = AtomicGuestStore()
        self.patches = (
            patch.object(player_service, "installation_has_guest", self.store.installation_has_guest),
            patch.object(player_service, "create_guest_player", self.store.create),
            patch.object(
                player_service,
                "find_internal_player_by_installation_hash",
                self.store.find_by_installation,
            ),
            patch.object(player_service, "recover_guest_credentials", self.store.recover),
            patch.object(player_service, "complete_guest_bootstrap", self.store.complete),
        )
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()

    def bootstrap(self):
        return player_service.bootstrap_guest(
            INSTALLATION_ID,
            RECOVERY_NONCE,
            now=INITIAL_TIME,
            recovery_window_seconds=600,
        )

    def recover(self, token="rotated-token", now=INITIAL_TIME + timedelta(seconds=30)):
        return player_service.recover_guest_bootstrap(
            INSTALLATION_ID,
            RECOVERY_NONCE,
            token,
            now=now,
        )

    def test_first_bootstrap_stores_only_hashes_and_duplicate_requires_recovery(self):
        response = self.bootstrap()
        self.assertTrue(response["auth_token"])
        self.assertEqual(
            self.store.document["auth_token_hash"],
            auth.hash_auth_token(response["auth_token"]),
        )
        self.assertEqual(
            self.store.document["bootstrap_recovery_nonce_hash"],
            auth.hash_recovery_nonce(RECOVERY_NONCE),
        )
        self.assertNotIn("auth_token", self.store.document)
        self.assertNotIn("recovery_nonce", self.store.document)
        with self.assertRaises(player_service.BootstrapAlreadyCompletedError):
            self.bootstrap()

    def test_lost_response_and_restart_recover_with_pre_persisted_replacement(self):
        original = self.bootstrap()["auth_token"]
        recovered = self.recover("pending-token-from-secure-storage")
        self.assertTrue(recovered["recovered"])
        self.assertNotEqual(
            self.store.document["auth_token_hash"],
            auth.hash_auth_token(original),
        )
        self.assertEqual(
            self.store.document["auth_token_hash"],
            auth.hash_auth_token("pending-token-from-secure-storage"),
        )

    def test_recovery_within_window_rotates_credentials_and_authenticates(self):
        original = self.bootstrap()["auth_token"]
        recovered = self.recover()
        with patch.object(auth, "find_internal_player", return_value=self.store.document):
            authenticated = auth.authenticated_player(
                recovered["player_id"],
                "Bearer rotated-token",
            )
            with self.assertRaises(HTTPException) as rejected:
                auth.authenticated_player(
                    recovered["player_id"],
                    f"Bearer {original}",
                )
        self.assertEqual(authenticated["player_id"], recovered["player_id"])
        self.assertEqual(rejected.exception.status_code, 401)

    def test_recovery_after_expiration_has_stable_error_code(self):
        self.bootstrap()
        with self.assertRaises(player_service.BootstrapRecoveryError) as raised:
            self.recover(now=INITIAL_TIME + timedelta(seconds=601))
        self.assertEqual(raised.exception.code, "GUEST_RECOVERY_EXPIRED")

    def test_invalid_nonce_does_not_rotate_credentials(self):
        response = self.bootstrap()
        before_hash = self.store.document["auth_token_hash"]
        with self.assertRaises(player_service.BootstrapRecoveryError) as raised:
            player_service.recover_guest_bootstrap(
                INSTALLATION_ID,
                "invalid_" + "x" * 32,
                "attacker-token",
                now=INITIAL_TIME + timedelta(seconds=1),
            )
        self.assertEqual(raised.exception.code, "GUEST_RECOVERY_INVALID")
        self.assertEqual(before_hash, auth.hash_auth_token(response["auth_token"]))
        self.assertEqual(self.store.document["auth_token_hash"], before_hash)

    def test_replay_is_rejected_after_single_use(self):
        self.bootstrap()
        self.recover()
        with self.assertRaises(player_service.BootstrapRecoveryError) as raised:
            self.recover("second-token")
        self.assertEqual(raised.exception.code, "GUEST_RECOVERY_USED")
        self.assertEqual(
            self.store.document["auth_token_hash"],
            auth.hash_auth_token("rotated-token"),
        )

    def test_concurrent_recovery_allows_exactly_one_rotation(self):
        self.bootstrap()

        def attempt(index):
            try:
                self.recover(f"rotated-token-{index}")
                return "success"
            except player_service.BootstrapRecoveryError as error:
                return error.code

        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(attempt, range(2)))
        self.assertEqual(outcomes.count("success"), 1)
        self.assertEqual(outcomes.count("GUEST_RECOVERY_USED"), 1)

    def test_successful_bootstrap_completion_cleans_recovery_state(self):
        response = self.bootstrap()
        internal = copy.deepcopy(self.store.document)
        result = player_service.finish_guest_bootstrap(internal)
        self.assertTrue(result["completed"])
        self.assertNotIn("bootstrap_recovery_nonce_hash", self.store.document)
        self.assertNotIn("bootstrap_recovery_expires_at", self.store.document)
        with patch.object(auth, "find_internal_player", return_value=self.store.document):
            self.assertEqual(
                auth.authenticated_player(
                    response["player_id"],
                    f"Bearer {response['auth_token']}",
                )["player_id"],
                response["player_id"],
            )


if __name__ == "__main__":
    unittest.main()
