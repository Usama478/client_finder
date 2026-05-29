from __future__ import annotations

import threading

# Redis-backed so the API server can read worker-side progress; the in-process
# dict is a same-process fallback when Redis is unavailable.
_RELEVANCE_PHASE: dict[int, str] = {}
_RELEVANCE_PHASE_LOCK = threading.Lock()

_PHASE_KIND = "relev"


def set_relevance_phase(business_id: int, phase: str | None) -> None:
    from app.core.redis_client import set_phase as _redis_set_phase

    _redis_set_phase(_PHASE_KIND, business_id, phase)
    with _RELEVANCE_PHASE_LOCK:
        if phase is None:
            _RELEVANCE_PHASE.pop(business_id, None)
        else:
            _RELEVANCE_PHASE[business_id] = phase


def get_relevance_phase(business_id: int) -> str | None:
    from app.core.redis_client import get_phase as _redis_get_phase

    phase = _redis_get_phase(_PHASE_KIND, business_id)
    if phase is not None:
        return phase
    with _RELEVANCE_PHASE_LOCK:
        return _RELEVANCE_PHASE.get(business_id)
