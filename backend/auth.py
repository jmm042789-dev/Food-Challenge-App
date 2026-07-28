"""Guest Bearer authentication for Fire Feast player accounts."""

import hashlib
import hmac
import logging
import re
import secrets
from typing import Optional

from fastapi import Header, HTTPException

from database import find_internal_player, find_internal_player_by_auth_hash


logger = logging.getLogger(__name__)
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


def _token_fingerprint(token: str) -> str:
    """A non-secret correlation value suitable for authentication logs."""
    return hash_auth_token(token)[:12]


def _unauthorized(reason: str, **context: object) -> HTTPException:
    logger.warning("Authentication rejected reason=%s context=%s", reason, context)
    return HTTPException(
        status_code=401,
        detail=AUTHENTICATION_ERROR,
        headers={"WWW-Authenticate": "Bearer"},
    )


def authenticate_bearer(authorization: Optional[str]) -> dict:
    if not authorization:
        raise _unauthorized("authorization_header_missing")
    scheme, separator, token = authorization.partition(" ")
    if (
        separator != " "
        or scheme.lower() != "bearer"
        or not token
        or len(token) > MAX_AUTH_TOKEN_LENGTH
        or any(character.isspace() for character in token)
    ):
        raise _unauthorized(
            "authorization_header_malformed",
            header_present=True,
            scheme=scheme[:16],
            token_length=len(token),
        )

    fingerprint = _token_fingerprint(token)
    logger.info(
        "Bearer credential received scheme=bearer token_fingerprint=%s token_length=%s",
        fingerprint,
        len(token),
    )
    return {"token": token, "fingerprint": fingerprint}


def authenticated_player(
    player_id: str,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    if not PLAYER_ID_PATTERN.fullmatch(player_id):
        raise _unauthorized("requested_player_id_invalid", requested_player_id=player_id[:128])
    credential = authenticate_bearer(authorization)
    player = find_internal_player(player_id)
    expected_hash = player.get("auth_token_hash") if player else None
    candidate_hash = hash_auth_token(credential["token"])
    if not isinstance(expected_hash, str) or not hmac.compare_digest(
        expected_hash,
        candidate_hash,
    ):
        raise _unauthorized(
            "player_or_token_mismatch",
            requested_player_id=player_id,
            player_found=player is not None,
            token_fingerprint=credential["fingerprint"],
        )
    logger.info(
        "Authentication accepted requested_player_id=%s authenticated_player_id=%s "
        "token_fingerprint=%s token_version=%s",
        player_id,
        player.get("player_id") or player.get("device_id"),
        credential["fingerprint"],
        player.get("token_version"),
    )
    return player


def authenticated_bearer_player(
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """Resolve a guest from its bearer credential without a client target ID."""
    credential = authenticate_bearer(authorization)
    candidate_hash = hash_auth_token(credential["token"])
    player = find_internal_player_by_auth_hash(candidate_hash)
    expected_hash = player.get("auth_token_hash") if player else None
    if not isinstance(expected_hash, str) or not hmac.compare_digest(
        expected_hash,
        candidate_hash,
    ):
        raise _unauthorized(
            "bearer_token_not_found",
            token_fingerprint=credential["fingerprint"],
        )
    logger.info(
        "Bearer session resolved authenticated_player_id=%s token_fingerprint=%s "
        "token_version=%s",
        player.get("player_id") or player.get("device_id"),
        credential["fingerprint"],
        player.get("token_version"),
    )
    return player


def require_same_player(authenticated: dict, requested_player_id: str) -> None:
    if authenticated.get("player_id") != requested_player_id:
        raise HTTPException(status_code=403, detail="action is not authorized")
