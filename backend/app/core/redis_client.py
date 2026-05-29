from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Phase strings are short-lived progress markers; a 60s TTL means a crashed
# worker never leaves a stale phase pinned in Redis.
PHASE_TTL_SECONDS = 60

_client = None
_client_failed = False


def get_redis():
    """Lazy singleton Redis client. Returns None if Redis is unavailable so
    callers can transparently fall back to in-process state."""
    global _client, _client_failed
    if _client is not None:
        return _client
    if _client_failed:
        return None
    url = os.getenv("REDIS_URL")
    if not url:
        _client_failed = True
        return None
    try:
        import redis

        _client = redis.Redis.from_url(url, decode_responses=True, socket_timeout=2)
        _client.ping()
        return _client
    except Exception as exc:  # pragma: no cover - depends on runtime infra
        logger.warning("redis_client: connection unavailable (%s); using in-process fallback", exc)
        _client_failed = True
        return None


def _phase_key(kind: str, business_id: int) -> str:
    return f"phase:{kind}:{business_id}"


def set_phase(kind: str, business_id: int, phase: Optional[str]) -> bool:
    """Write a phase marker to Redis with a TTL. Returns True on success."""
    client = get_redis()
    if client is None:
        return False
    try:
        key = _phase_key(kind, business_id)
        if phase is None:
            client.delete(key)
        else:
            client.setex(key, PHASE_TTL_SECONDS, phase)
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("redis_client: set_phase failed key=%s err=%s", kind, exc)
        return False


def get_phase(kind: str, business_id: int) -> Optional[str]:
    client = get_redis()
    if client is None:
        return None
    try:
        return client.get(_phase_key(kind, business_id))
    except Exception as exc:  # pragma: no cover
        logger.warning("redis_client: get_phase failed key=%s err=%s", kind, exc)
        return None
