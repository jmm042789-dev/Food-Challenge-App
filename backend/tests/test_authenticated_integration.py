"""Opt-in, read-only authenticated smoke test against a deployed backend."""

import os

import pytest
import requests


pytestmark = pytest.mark.integration
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
AUTH_TOKEN = os.environ.get("FIRE_FEAST_INTEGRATION_AUTH_TOKEN", "").strip()


def test_authenticated_guest_session():
    if not BASE_URL:
        pytest.skip("EXPO_PUBLIC_BACKEND_URL is required for live integration tests")
    if not AUTH_TOKEN:
        pytest.skip("FIRE_FEAST_INTEGRATION_AUTH_TOKEN is required for authenticated integration tests")
    response = requests.get(
        f"{BASE_URL}/api/auth/session",
        headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
        timeout=10,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body.get("player_id"), str) and body["player_id"]
    assert isinstance(body.get("player"), dict)
