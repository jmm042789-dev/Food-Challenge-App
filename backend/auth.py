"""Guest Bearer authentication for Fire Feast player accounts."""

import hashlib
import hmac
import re
import secrets
from typing import Optional

from fastapi import Header, HTTPException

from database import find_internal_player


AUTH_TOKEN_BYTES = 32
AUTH_TOKEN_VERSION = 1
AUTHENTICATION_ERROR = "invalid or missing authentication credentials"
PLAYER_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
MAX_AUTH_TOKEN_LENGTH = 512


def generate_auth_token() -> str:
    return secrets.token_urlsafe(AUTH_TOKEN_BYTES)


def hash_auth_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_installation_id(installation_id: str) -> str:
    return hashlib.sha256(installation_id.encode("utf-8")).hexdigest()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=AUTHENTICATION_ERROR,
        headers={"WWW-Authenticate": "Bearer"},
    )


def authenticate_bearer(authorization: Optional[str]) -> dict:
    if not authorization:
        raise _unauthorized()
    scheme, separator, token = authorization.partition(" ")
    if (
        separator != " "
        or scheme.lower() != "bearer"
        or not token
        or len(token) > MAX_AUTH_TOKEN_LENGTH
        or any(character.isspace() for character in token)
    ):
        raise _unauthorized()

    # The public ID is supplied separately by each protected route. Looking up
    # by token hash would turn the hash into a credential index, so route
    # dependencies resolve the account after extracting the token.
    return {"token": token}


def authenticated_player(
    player_id: str,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    if not PLAYER_ID_PATTERN.fullmatch(player_id):
        raise _unauthorized()
    credential = authenticate_bearer(authorization)
    player = find_internal_player(player_id)
    expected_hash = player.get("auth_token_hash") if player else None
    candidate_hash = hash_auth_token(credential["token"])
    if not isinstance(expected_hash, str) or not hmac.compare_digest(
        expected_hash,
        candidate_hash,
    ):
        raise _unauthorized()
    return player


def require_same_player(authenticated: dict, requested_player_id: str) -> None:
    if authenticated.get("player_id") != requested_player_id:
        raise HTTPException(status_code=403, detail="action is not authorized")
