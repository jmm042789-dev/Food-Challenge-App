"""Small in-process rate limiter for closed-beta API abuse protection."""

from collections import OrderedDict, deque
from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Callable

from fastapi import HTTPException, Request


RATE_LIMIT_ERROR = "too many requests"
MAX_RATE_LIMIT_KEYS = 10_000


@dataclass(frozen=True)
class RateLimit:
    requests: int
    window_seconds: int


class InMemoryRateLimiter:
    """Thread-safe sliding-window accounting keyed by route and client IP."""

    def __init__(self) -> None:
        self._events: OrderedDict[str, deque[float]] = OrderedDict()
        self._lock = Lock()

    def check(self, key: str, limit: RateLimit, now: float | None = None) -> None:
        current = monotonic() if now is None else now
        cutoff = current - limit.window_seconds
        with self._lock:
            events = self._events.get(key)
            if events is None:
                if len(self._events) >= MAX_RATE_LIMIT_KEYS:
                    self._events.popitem(last=False)
                events = deque()
                self._events[key] = events
            else:
                self._events.move_to_end(key)
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit.requests:
                raise HTTPException(status_code=429, detail=RATE_LIMIT_ERROR)
            events.append(current)

    def clear(self) -> None:
        """Test helper; production accounting expires naturally."""
        with self._lock:
            self._events.clear()


limiter = InMemoryRateLimiter()


def rate_limit(scope: str, requests: int, window_seconds: int) -> Callable:
    """Build a FastAPI dependency without retaining request credentials."""
    limit = RateLimit(requests=requests, window_seconds=window_seconds)

    def enforce(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        limiter.check(f"{scope}:{client_ip}", limit)

    return enforce
