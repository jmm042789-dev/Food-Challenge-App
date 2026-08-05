"""Validated backend configuration with no secret-bearing log output."""

from dataclasses import dataclass
import os
from pathlib import Path
import re
from typing import Mapping, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv


load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=False)


VALID_ENVIRONMENTS = {"development", "preview", "production", "test"}
DB_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
DEFAULT_STARTING_COINS = 500
DEFAULT_GUEST_RECOVERY_WINDOW_SECONDS = 10 * 60
MIN_GUEST_RECOVERY_WINDOW_SECONDS = 60
MAX_GUEST_RECOVERY_WINDOW_SECONDS = 60 * 60


class ConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class BackendConfig:
    environment: str
    mongo_url: str
    db_name: str
    cors_origins: tuple[str, ...]
    guest_recovery_window_seconds: int = DEFAULT_GUEST_RECOVERY_WINDOW_SECONDS

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def _required(source: Mapping[str, str], key: str) -> str:
    value = source.get(key, "").strip()
    if not value:
        raise ConfigurationError(f"required environment variable {key} is missing")
    return value


def _validate_mongo_url(value: str, *, is_production: bool) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in {"mongodb", "mongodb+srv"}:
        raise ConfigurationError("MONGO_URL must use mongodb:// or mongodb+srv://")
    if not parsed.hostname:
        raise ConfigurationError("MONGO_URL must include a hostname")
    if is_production and parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
        raise ConfigurationError("production MONGO_URL must not use a loopback host")


def _parse_origins(value: str, *, is_production: bool) -> tuple[str, ...]:
    origins = tuple(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())
    for origin in origins:
        parsed = urlparse(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ConfigurationError("FIRE_FEAST_CORS_ORIGINS contains an invalid origin")
        if is_production and parsed.scheme != "https":
            raise ConfigurationError("production CORS origins must use HTTPS")
    return origins


def _parse_recovery_window(value: str) -> int:
    if not value.strip():
        return DEFAULT_GUEST_RECOVERY_WINDOW_SECONDS
    try:
        seconds = int(value)
    except ValueError as error:
        raise ConfigurationError(
            "FIRE_FEAST_GUEST_RECOVERY_WINDOW_SECONDS must be an integer"
        ) from error
    if not MIN_GUEST_RECOVERY_WINDOW_SECONDS <= seconds <= MAX_GUEST_RECOVERY_WINDOW_SECONDS:
        raise ConfigurationError(
            "FIRE_FEAST_GUEST_RECOVERY_WINDOW_SECONDS must be between 60 and 3600"
        )
    return seconds


def load_config(
    source: Optional[Mapping[str, str]] = None,
    *,
    require_database: bool = True,
) -> BackendConfig:
    """Load validated settings.

    Database settings and an explicit deployment environment are mandatory at
    application startup. Import-time app construction may request a partial
    configuration so isolated tests can import routes without infrastructure;
    startup validation still prevents the service from accepting traffic.
    """
    values = os.environ if source is None else source
    raw_environment = values.get("FIRE_FEAST_ENV", "").strip().lower()
    if not raw_environment and require_database:
        raise ConfigurationError(
            "required environment variable FIRE_FEAST_ENV is missing"
        )
    environment = raw_environment or "development"
    if environment not in VALID_ENVIRONMENTS:
        raise ConfigurationError(
            "FIRE_FEAST_ENV must be development, preview, production, or test"
        )

    mongo_url = (
        _required(values, "MONGO_URL")
        if require_database
        else values.get("MONGO_URL", "").strip()
    )
    db_name = (
        _required(values, "DB_NAME")
        if require_database
        else values.get("DB_NAME", "").strip()
    )
    if mongo_url:
        _validate_mongo_url(mongo_url, is_production=environment == "production")
    if db_name and not DB_NAME_PATTERN.fullmatch(db_name):
        raise ConfigurationError(
            "DB_NAME must contain only letters, numbers, underscores, or hyphens"
        )

    origins = _parse_origins(
        values.get("FIRE_FEAST_CORS_ORIGINS", ""),
        is_production=environment == "production",
    )
    recovery_window = _parse_recovery_window(
        values.get("FIRE_FEAST_GUEST_RECOVERY_WINDOW_SECONDS", "")
    )
    return BackendConfig(
        environment=environment,
        mongo_url=mongo_url,
        db_name=db_name,
        cors_origins=origins,
        guest_recovery_window_seconds=recovery_window,
    )
