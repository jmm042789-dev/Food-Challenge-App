"""ASGI-level request correlation and log-redaction tests."""

import asyncio
import json
import logging
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import database
import server
from observability import REQUEST_ID_HEADER, valid_request_id


async def _asgi_request(path, *, method="GET", headers=None, body=b"", query=b""):
    messages = []
    request_sent = False
    waiting = asyncio.Event()

    async def receive():
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        await waiting.wait()

    async def send(message):
        messages.append(message)

    raw_headers = [
        (name.lower().encode("ascii"), value.encode("ascii"))
        for name, value in (headers or {}).items()
    ]
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": query,
        "root_path": "",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    await server.app(scope, receive, send)
    start = next(message for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    response_headers = {
        key.decode("latin-1").lower(): value.decode("latin-1")
        for key, value in start["headers"]
    }
    return start["status"], response_headers, response_body


def request(path, **options):
    return asyncio.run(_asgi_request(path, **options))


class RequestObservabilityTests(unittest.TestCase):
    def tearDown(self):
        database.mongo_client = None

    def test_missing_request_id_generates_valid_header_on_success(self):
        status, headers, _body = request("/api/test")
        self.assertEqual(status, 200)
        self.assertTrue(valid_request_id(headers[REQUEST_ID_HEADER.lower()]))
        self.assertRegex(headers[REQUEST_ID_HEADER.lower()], r"^[a-f0-9]{32}$")

    def test_valid_incoming_request_id_is_preserved(self):
        incoming = "a1" * 16
        _status, headers, _body = request(
            "/api/test",
            headers={REQUEST_ID_HEADER: incoming},
        )
        self.assertEqual(headers[REQUEST_ID_HEADER.lower()], incoming)

    def test_malformed_and_oversized_request_ids_are_replaced(self):
        for incoming in ("bad id/with?punctuation", "a" * 65, "ABCDEF1234567890"):
            with self.subTest(incoming=incoming):
                _status, headers, _body = request(
                    "/api/test",
                    headers={REQUEST_ID_HEADER: incoming},
                )
                generated = headers[REQUEST_ID_HEADER.lower()]
                self.assertNotEqual(generated, incoming)
                self.assertTrue(valid_request_id(generated))

    def test_request_id_is_returned_for_validation_and_authentication_failures(self):
        validation = request(
            "/api/auth/guest",
            method="POST",
            headers={"Content-Type": "application/json"},
            body=b"{}",
        )
        authentication = request("/api/auth/session")
        self.assertEqual(validation[0], 422)
        self.assertEqual(authentication[0], 401)
        self.assertTrue(valid_request_id(validation[1]["x-request-id"]))
        self.assertTrue(valid_request_id(authentication[1]["x-request-id"]))

    def test_request_id_is_returned_for_readiness_503(self):
        database.mongo_client = None
        status, headers, body = request("/api/health/ready")
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(body), {"status": "unavailable"})
        self.assertTrue(valid_request_id(headers["x-request-id"]))

    def test_unexpected_500_has_request_id_and_sanitized_error_log(self):
        secret = "mongodb://user:password@host/private"
        request_id = "b2" * 16
        with (
            patch.object(server, "featured", side_effect=RuntimeError(secret)),
            self.assertLogs(server.logger, level=logging.INFO) as captured,
        ):
            status, headers, body = request(
                "/api/featured-contest",
                headers={REQUEST_ID_HEADER: request_id},
            )
        logs = " ".join(captured.output)
        self.assertEqual(status, 500)
        self.assertEqual(json.loads(body), {"detail": "internal server error"})
        self.assertEqual(headers["x-request-id"], request_id)
        self.assertIn(f"request_id={request_id}", logs)
        self.assertIn("exception=RuntimeError", logs)
        self.assertNotIn(secret, logs)

    def test_completion_log_has_safe_metadata_and_redacts_inputs(self):
        request_id = "c3" * 16
        bearer = "super-secret-bearer-value"
        nonce = "bootstrap-secret-nonce-value"
        query_secret = "query-secret-value"
        body = json.dumps(
            {"installation_id": "installation_" + "a" * 32, "recovery_nonce": nonce}
        ).encode("utf-8")
        with self.assertLogs(server.logger, level=logging.INFO) as captured:
            status, _headers, _body = request(
                "/api/auth/guest",
                method="POST",
                headers={
                    REQUEST_ID_HEADER: request_id,
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {bearer}",
                },
                body=body,
                query=f"token={query_secret}".encode("ascii"),
            )
        logs = " ".join(captured.output)
        self.assertIn(f"request_id={request_id}", logs)
        self.assertIn("method=POST", logs)
        self.assertIn("route=/api/auth/guest", logs)
        self.assertRegex(logs, rf"status={status} duration_ms=\d+\.\d{{2}}")
        for sensitive in (bearer, nonce, query_secret, "Authorization"):
            self.assertNotIn(sensitive, logs)


if __name__ == "__main__":
    unittest.main()
