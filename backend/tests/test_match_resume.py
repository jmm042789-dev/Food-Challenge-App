"""Resume-only contract tests. In-memory players; no external services."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack, contextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
import asyncio
import json as json_module
from types import SimpleNamespace
from tests.test_observability import _asgi_request

import auth
import server
from models import MatchResume
from services import match_service as service

NOW = datetime(2026, 10, 11, 12, tzinfo=timezone.utc)
CONTEST = "nathans-hotdogs"


def post_resume(*, json, headers=None):
    status, _, body = asyncio.run(_asgi_request(
        "/api/match/resume", method="POST",
        headers={"content-type": "application/json", **(headers or {})},
        body=json_module.dumps(json).encode()))
    return SimpleNamespace(status_code=status, json=lambda: json_module.loads(body))


def player_fixture():
    # Build the snapshot with the production start implementation, not a second
    # approximation of gameplay or equipment configuration.
    player = {"device_id": "player-a", "player_id": "player-a", "coins": 100,
              "antacid": 3, "equipped_gear": None}
    def capture(device_id, fee, match):
        player["coins"] -= fee
        player["active_match"] = deepcopy(match)
        return player
    with (patch.object(service, "find_internal_player", return_value=player),
          patch.object(service, "expire_stale_match", return_value=False),
          patch.object(service, "start_player_match", side_effect=capture),
          patch.object(service, "_remove_player_matchmaking_state"),
          patch.object(service, "_utc_now", return_value=NOW)):
        service.start_match("player-a", CONTEST)
    return player


@contextmanager
def guarded(player, reads=None, times=None):
    before = deepcopy(player)
    with ExitStack() as stack:
        stack.enter_context(patch.object(service, "find_internal_player",
            side_effect=reads, return_value=player))
        stack.enter_context(patch.object(service, "_utc_now",
            side_effect=times, return_value=NOW))
        writers = [stack.enter_context(patch.object(service, name,
            side_effect=AssertionError("Forbidden resume mutation: " + name)))
            for name in ("start_match", "start_player_match", "settle_player_match",
                         "transition_player_match", "expire_stale_match",
                         "_remove_player_matchmaking_state")]
        yield
        for writer in writers:
            writer.assert_not_called()
    assert player == before


def resume(player, **overrides):
    args = {"device_id": "player-a", "match_id": player["active_match"]["id"],
            "contest_id": CONTEST}
    args.update(overrides)
    return service.resume_match(**args)


def test_success_preserves_fee_configuration_timing_and_returns_detached_snapshot():
    player = player_fixture()
    active = player["active_match"]
    with guarded(player):
        response = resume(player)
        assert response["start"] == active["start_response"]
        assert response["server_time"] == NOW.isoformat()
        assert response["start"]["server_started_at"] == active["started_at"]
        assert response["start"]["perk_modifiers"] == active["perk_modifiers"]
        assert player["coins"] == 50
        response["start"]["perk_modifiers"]["tap_power"] = 999
        assert active["perk_modifiers"]["tap_power"] != 999


def test_resume_with_zero_balance_and_changed_current_equipment():
    player = player_fixture()
    player.update(coins=0, equipped_gear="unrelated-current-equipment")
    with guarded(player):
        assert resume(player)["start"] == player["active_match"]["start_response"]


@pytest.mark.parametrize("during", [False, True])
def test_exact_expiry_before_or_during_processing(during):
    player = player_fixture()
    expiry = datetime.fromisoformat(player["active_match"]["expires_at"])
    with guarded(player, times=[NOW, expiry] if during else [expiry]):
        with pytest.raises(service.MatchExpiredError):
            resume(player)


def test_just_before_expiry_remains_resumable_without_extending_deadline():
    player = player_fixture()
    expiry = datetime.fromisoformat(player["active_match"]["expires_at"])
    with guarded(player, times=[NOW, expiry - timedelta(microseconds=1)]):
        assert resume(player)["start"]["expires_at"] == expiry.isoformat()


@pytest.mark.parametrize("overrides", [
    {"match_id": "wrong"}, {"contest_id": "wing-bowl"}, {"device_id": "player-b"}])
def test_identity_mismatch(overrides):
    player = player_fixture()
    with guarded(player):
        with pytest.raises(service.MatchNotFoundError):
            resume(player, **overrides)


@pytest.mark.parametrize("status", ["settled", "rejected", "cancelled", "expired"])
@pytest.mark.parametrize("during", [False, True])
def test_terminal_lifecycle_never_resumes(status, during):
    player = player_fixture()
    terminal = deepcopy(player)
    terminal.pop("active_match")
    terminal["last_match_lifecycle"] = {"status": status}
    with guarded(player, reads=[player, terminal] if during else [terminal]):
        with pytest.raises(service.MatchNotFoundError):
            resume(player)


@pytest.mark.parametrize("field,value", [("id", "replacement"),
    ("contest_id", "wing-bowl"), ("device_id", "player-b"), ("status", "settled")])
def test_changed_match_during_read_is_rejected(field, value):
    player = player_fixture()
    changed = deepcopy(player)
    changed["active_match"][field] = value
    with guarded(player, reads=[player, changed]):
        with pytest.raises(service.MatchNotFoundError):
            resume(player)


def test_configuration_change_during_read_is_rejected():
    player = player_fixture()
    changed = deepcopy(player)
    changed["active_match"]["start_response"]["perk_modifiers"]["tap_power"] = 99
    with guarded(player, reads=[player, changed]):
        with pytest.raises(service.MatchNotFoundError):
            resume(player)


def test_deleted_player_during_request_is_rejected():
    player = player_fixture()
    with guarded(player, reads=[player, None]):
        with pytest.raises(service.PlayerNotFoundError):
            resume(player)


@pytest.mark.parametrize("field,value", [("start_response", None),
    ("schema_version", -1), ("started_at", "invalid")])
def test_invalid_snapshot_fails_closed(field, value):
    player = player_fixture()
    player["active_match"][field] = value
    with guarded(player):
        with pytest.raises((service.MatchNotFoundError, service.MatchExpiredError)):
            resume(player)


def test_concurrent_requests_do_not_create_charge_or_mutate():
    player = player_fixture()
    with guarded(player), ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(lambda _: resume(player), range(24)))
        assert all(r == responses[0] for r in responses)


@pytest.mark.parametrize("body", [{}, {"match_id": "a"},
    {"match_id": "a", "contest_id": CONTEST, "device_id": "victim"},
    {"match_id": "../bad", "contest_id": CONTEST}])
def test_http_model_rejects_missing_unsafe_and_extra_identity_fields(body):
    with patch.object(server, "resume_match") as operation:
        response = post_resume( json=body)
        assert response.status_code == 422
        operation.assert_not_called()


def test_http_missing_authentication_cannot_reach_service():
    with patch.object(server, "resume_match") as operation:
        response = post_resume(
            json={"match_id": "a", "contest_id": CONTEST})
        assert response.status_code == 401
        operation.assert_not_called()


def test_http_real_bearer_resolution_binds_to_authenticated_player():
    player = player_fixture()
    player["auth_token_hash"] = auth.hash_auth_token("test-token")
    body = {"match_id": player["active_match"]["id"], "contest_id": CONTEST}
    with guarded(player), patch.object(auth, "find_internal_player_by_auth_hash", return_value=player):
        response = post_resume( json=body,
            headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 200
        assert response.json()["start"] == player["active_match"]["start_response"]


def test_other_authenticated_player_cannot_obtain_snapshot():
    player = player_fixture()
    other = {"device_id": "player-b", "auth_token_hash": auth.hash_auth_token("other-token")}
    with guarded(player), patch.object(auth, "find_internal_player_by_auth_hash", return_value=other):
        response = post_resume(
            json={"match_id": player["active_match"]["id"], "contest_id": CONTEST},
            headers={"Authorization": "Bearer other-token"})
        assert response.status_code == 409
        assert response.json()["detail"] == {"code": "MATCH_NOT_RESUMABLE"}


@pytest.mark.parametrize("error,status,code", [
    (service.MatchExpiredError, 410, "MATCH_EXPIRED"),
    (service.MatchNotFoundError, 409, "MATCH_NOT_RESUMABLE")])
def test_endpoint_error_contract(error, status, code):
    with (patch.object(server, "authenticated_bearer_player", return_value={"device_id": "a"}),
          patch.object(server, "resume_match", side_effect=error)):
        with pytest.raises(HTTPException) as caught:
            server.match_resume_endpoint(MatchResume(match_id="a", contest_id=CONTEST), "Bearer token")
        assert caught.value.status_code == status
        assert caught.value.detail == {"code": code}
