"""Adversarial production-readiness checks for Level 2.5 settlement."""

import asyncio
import json
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Request
from pydantic import ValidationError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import database
from models import MatchInputEvent, MatchResult
from services import match_service
from services.match_validation import InputReplayError, replay_input_log, trusted_heat_per_tap
from data.contests import CONTESTS
import server
from tests.test_match_anti_cheat import NOW, active_match, bite_events, valid_result


def request_for(body_chunks, path="/api/match/result", content_length=None):
    chunks = list(body_chunks)
    headers = [] if content_length is None else [(b"content-length", str(content_length).encode())]
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "POST", "scheme": "https", "path": path, "raw_path": path.encode(),
        "query_string": b"", "headers": headers, "client": ("127.0.0.1", 1),
        "server": ("test", 443),
    }

    async def receive():
        chunk = chunks.pop(0) if chunks else b""
        return {"type": "http.request", "body": chunk, "more_body": bool(chunks)}

    return Request(scope, receive)


class MatchSecurityAuditTests(unittest.TestCase):
    def tearDown(self):
        match_service.queue.clear()
        match_service.active_matches.clear()

    def test_replay_defense_rejects_negative_boolean_gap_duplicate_and_rollback(self):
        cases = (
            ([{"seq": 1, "t_ms": -1, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "malformed_timestamp"),
            ([{"seq": True, "t_ms": 1, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "malformed_sequence"),
            ([{"seq": 1, "t_ms": 1, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}, {"seq": 3, "t_ms": 2, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "malformed_sequence"),
            ([{"seq": 1, "t_ms": 1, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}, {"seq": 1, "t_ms": 2, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "malformed_sequence"),
            ([{"seq": 1, "t_ms": 2, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}, {"seq": 2, "t_ms": 1, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}], "out_of_order_timestamp"),
        )
        for events, reason in cases:
            with self.subTest(reason=reason), self.assertRaises(InputReplayError) as raised:
                replay_input_log(active_match(), events)
            self.assertEqual(raised.exception.reason, reason)

    def test_authoritative_heat_matches_current_client_resolution_for_every_contest(self):
        expected = {
            "nathans-hotdogs": 5,
            "wing-bowl": 8,
            "pizza-hut-stuffed": 6,
            "katz-pastrami": 5,
            "ben-jerry-icecream": 4,
            "in-n-out-burgers": 7,
        }
        self.assertEqual({contest["id"]: trusted_heat_per_tap(contest) for contest in CONTESTS}, expected)

    def test_alternating_actions_cannot_evade_rate_or_mode_validation(self):
        events = [
            {"seq": index + 1, "t_ms": index, "type": "ANTACID" if index % 2 else "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}
            for index in range(31)
        ]
        with self.assertRaises(InputReplayError) as raised:
            replay_input_log(active_match(), events)
        self.assertIn(raised.exception.reason, {"impossible_input_rate", "invalid_antacid_use"})

    def test_event_schema_enforces_strict_types_and_maximum_boundary(self):
        with self.assertRaises(ValidationError):
            MatchInputEvent(seq=True, t_ms=1, type="BITE", source="CONTROL", x=0.5, y=0.5)
        with self.assertRaises(ValidationError):
            MatchInputEvent(seq=1, t_ms="1", type="BITE", source="CONTROL", x=0.5, y=0.5)
        base = {
            "device_id": "player-a", "match_id": "match-a", "contest_id": "nathans",
            "opponent_id": "opponent-a", "score": 0, "opponent_score": 0,
            "duration_sec": 60, "accepted_taps": 0, "completed_progress": 0,
            "maximum_combo": 0, "validation_version": 2,
        }
        events = [{"seq": index + 1, "t_ms": index * 50, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5} for index in range(2000)]
        self.assertEqual(len(MatchResult(**base, input_events=events).input_events), 2000)
        with self.assertRaises(ValidationError):
            MatchResult(**base, input_events=events + [{"seq": 2001, "t_ms": 100000, "type": "BITE", "source": "CONTROL", "x": 0.5, "y": 0.5}])
        with self.assertRaises(ValidationError):
            MatchResult(**base)  # Legacy clients cannot omit Level 2.5 input data.

    def test_request_limit_accepts_bounded_log_and_rejects_chunked_flood(self):
        legitimate = json.dumps({
            "input_events": [{"seq": index + 1, "t_ms": index * 50, "type": "SLICE", "source": "CONTROL", "start_x": 0.1234, "start_y": 0.5678, "end_x": 0.9876, "end_y": 0.5432, "duration_ms": 700} for index in range(2000)]
        }).encode()
        self.assertLess(len(legitimate), server.MAX_MATCH_RESULT_REQUEST_BYTES)

        async def accepted():
            request = request_for([legitimate[:40000], legitimate[40000:]])
            async def downstream(received):
                self.assertEqual(await received.body(), legitimate)
                return server.JSONResponse({"ok": True})
            return await server.reject_oversized_requests(request, downstream)

        async def rejected():
            chunk = b"x" * 200000
            called = False
            async def downstream(_received):
                nonlocal called
                called = True
                return server.JSONResponse({"ok": True})
            response = await server.reject_oversized_requests(request_for([chunk, chunk]), downstream)
            return response, called

        self.assertEqual(asyncio.run(accepted()).status_code, 200)
        response, called = asyncio.run(rejected())
        self.assertEqual(response.status_code, 413)
        self.assertFalse(called)

    def test_public_rejection_is_generic_and_hides_internal_reason(self):
        result = MatchResult(**{
            **valid_result().__dict__,
            "input_events": [event.__dict__ for event in valid_result().input_events],
        })
        with (
            patch.object(server, "authenticated_player", return_value={"device_id": "player-a"}),
            patch.object(server, "submit_result", side_effect=match_service.MatchValidationError("impossible_input_rate")),
        ):
            with self.assertRaises(HTTPException) as raised:
                server.match_result(result, "Bearer opaque")
        self.assertEqual(raised.exception.status_code, 400)
        serialized = repr(raised.exception.detail)
        self.assertNotIn("impossible_input_rate", serialized)
        self.assertNotIn("reason", raised.exception.detail)

    def test_modified_finalized_replay_and_old_payload_during_new_match_do_not_settle(self):
        original = valid_result()
        fingerprint = match_service._fingerprint(original)
        stored = {"match_id": "match-a", "fingerprint": fingerprint, "response": {"coin_reward": 500}}
        modified_payloads = (
            valid_result(score=original.score + 1),
            valid_result(contest_id="different-contest"),
            valid_result(events=bite_events(count=59)),
        )
        for modified in modified_payloads:
            with (
                patch.object(match_service, "find_internal_player", return_value={"device_id": "player-a", "last_match_result": stored}),
                patch.object(match_service, "expire_stale_match", return_value=False),
            ):
                with self.assertRaises(match_service.MatchNotFoundError):
                    match_service.submit_result(modified)

        newer = active_match()
        newer["id"] = "match-b"
        with (
            patch.object(match_service, "find_internal_player", return_value={"device_id": "player-a", "active_match": newer, "last_match_result": stored}),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "settle_player_match") as settle,
        ):
            replayed = match_service.submit_result(original)
        self.assertTrue(replayed["already_finalized"])
        self.assertEqual(replayed["coin_reward"], 500)
        settle.assert_not_called()

    def test_abandoned_match_cannot_be_settled(self):
        player = {"device_id": "player-a", "last_match_lifecycle": {"match_id": "match-a", "status": "cancelled"}}
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "settle_player_match") as settle,
        ):
            with self.assertRaises(match_service.MatchNotFoundError):
                match_service.submit_result(valid_result())
        settle.assert_not_called()

    def test_atomic_match_filter_allows_only_one_concurrent_winner(self):
        class AtomicCollection:
            def __init__(self):
                self.lock = threading.Lock()
                self.active = True
            def find_one_and_update(self, query, pipeline, return_document=None):
                with self.lock:
                    if not self.active or query != {"device_id": "player-a", "active_match.id": "match-a"}:
                        return None
                    self.active = False
                    return {"last_match_result": {"response": {"coin_reward": 500}}}

        collection = AtomicCollection()
        results = []
        threads = [threading.Thread(target=lambda: results.append(database.settle_player_match("player-a", "match-a", [{"$set": {"coins": 1}}]))) for _ in range(20)]
        with patch.object(database, "_players", return_value=collection):
            for thread in threads: thread.start()
            for thread in threads: thread.join()
        self.assertEqual(sum(result is not None for result in results), 1)

    def test_audit_response_contains_diagnostics_but_no_seed(self):
        active = active_match()
        submitted = valid_result(active)
        player = {"device_id": "player-a", "coins": 100, "xp": 0, "active_match": active}
        captured = {}
        def settle(_device, _match, pipeline):
            finalized = pipeline[0]["$set"]["last_match_result"]
            captured.update(finalized)
            return {"last_match_result": finalized}
        with (
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "settle_player_match", side_effect=settle),
        ):
            response = match_service.submit_result(submitted)
        serialized = repr({"response": response, "stored": captured})
        self.assertNotIn(active["match_seed"], serialized)
        self.assertEqual(set(captured["fingerprint"]), {"version", "sha256"})
        self.assertEqual(len(captured["fingerprint"]["sha256"]), 64)
        self.assertNotIn("input_events", captured["fingerprint"])
        for field in ("status", "reason_codes", "input_event_count", "peak_input_rate", "replayed_score", "submitted_score", "score_delta", "validation_version", "maximum_combo", "peak_heat", "validation_elapsed_ms"):
            self.assertIn(field, response["anti_cheat"])

    def test_production_response_hides_audit_but_persists_it_server_side(self):
        active = active_match()
        submitted = valid_result(active)
        player = {"device_id": "player-a", "coins": 100, "xp": 0, "active_match": active}
        captured = {}
        def settle(_device, _match, pipeline):
            finalized = pipeline[0]["$set"]["last_match_result"]
            captured.update(finalized)
            return {"last_match_result": finalized}
        with (
            patch.object(match_service, "MATCH_DIAGNOSTICS_ENABLED", False),
            patch.object(match_service, "find_internal_player", return_value=player),
            patch.object(match_service, "expire_stale_match", return_value=False),
            patch.object(match_service, "get_contest", return_value={"id": "nathans"}),
            patch.object(match_service, "_utc_now", return_value=NOW),
            patch.object(match_service, "settle_player_match", side_effect=settle),
        ):
            response = match_service.submit_result(submitted)
        self.assertNotIn("anti_cheat", response)
        self.assertNotIn("validation_outcome", response)
        self.assertIn("anti_cheat", captured)
        self.assertNotIn(active["match_seed"], repr(captured))

    def test_cross_player_identity_is_rejected_before_submission(self):
        result = MatchResult(**{
            **valid_result().__dict__,
            "input_events": [event.__dict__ for event in valid_result().input_events],
        })
        with (
            patch.object(server, "authenticated_player", side_effect=HTTPException(status_code=401, detail="invalid credentials")),
            patch.object(server, "submit_result") as submit,
        ):
            with self.assertRaises(HTTPException) as raised:
                server.match_result(result, "Bearer another-player")
        self.assertEqual(raised.exception.status_code, 401)
        submit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
