"""Safe request-correlation helpers with no request-content logging."""

import re
import secrets
from typing import Optional

from fastapi import Request


REQUEST_ID_HEADER = "X-Request-ID"
REQUEST_ID_MIN_LENGTH = 16
REQUEST_ID_MAX_LENGTH = 64
REQUEST_ID_PATTERN = re.compile(
    rf"^[a-f0-9]{{{REQUEST_ID_MIN_LENGTH},{REQUEST_ID_MAX_LENGTH}}}$"
)


def valid_request_id(value: Optional[str]) -> bool:
    return isinstance(value, str) and REQUEST_ID_PATTERN.fullmatch(value) is not None


def generate_request_id() -> str:
    return secrets.token_hex(16)


def request_id_for(value: Optional[str]) -> str:
    return value if valid_request_id(value) else generate_request_id()


def request_id_from(request: Request) -> str:
    value = getattr(request.state, "request_id", None)
    return value if valid_request_id(value) else generate_request_id()


def safe_request_route(request: Request) -> str:
    route = request.scope.get("route")
    template = getattr(route, "path", None)
    if isinstance(template, str) and template.startswith("/"):
        return template

    return "/{unmatched}"


def response_outcome(status_code: int) -> str:
    if status_code >= 500:
        return "server_error"
    if status_code >= 400:
        return "client_error"
    return "success"
