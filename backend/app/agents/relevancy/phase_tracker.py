from __future__ import annotations

import threading

_RELEVANCE_PHASE: dict[int, str] = {}
_RELEVANCE_PHASE_LOCK = threading.Lock()


def set_relevance_phase(business_id: int, phase: str | None) -> None:
    with _RELEVANCE_PHASE_LOCK:
        if phase is None:
            _RELEVANCE_PHASE.pop(business_id, None)
        else:
            _RELEVANCE_PHASE[business_id] = phase


def get_relevance_phase(business_id: int) -> str | None:
    with _RELEVANCE_PHASE_LOCK:
        return _RELEVANCE_PHASE.get(business_id)
