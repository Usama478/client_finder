from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

BACKEND_DIR = Path(__file__).resolve().parents[4]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.agents.relevancy.graph import relevancy_graph
from app.agents.relevancy.state import RelevancyAgentState


def _normalize_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    if value.startswith(("http://", "https://")):
        return value
    return f"https://{value}"


def _hostname(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc or url


def _build_initial_state(url: str, exporter_profile: str) -> RelevancyAgentState:
    host = _hostname(url)
    return {
        "business_id": 0,
        "search_id": 0,
        "business_name": host,
        "category": None,
        "website": url,
        "address": None,
        "description": None,
        "exporter_profile": exporter_profile,
        "website_exists": None,
        "is_marketplace": False,
        "evidence": None,
        "collect_sources_output": {},
        "collect_blocked": False,
        "collect_block_reason": None,
        "collect_needs_browser": False,
        "collect_status_code": None,
        "platform_detection_output": {
            "platform": "unknown",
            "confidence": 0.0,
            "shopify_detected": False,
            "reasons": [],
        },
        "shopify_probe_output": {
            "performed": False,
            "detected": False,
            "confidence": 0.0,
            "signals": [],
        },
        "structured_signals_output": {
            "entities": [],
            "counts": {"json-ld": 0, "microdata": 0, "rdfa": 0},
            "signal_flags": [],
            "strong_signal": False,
            "quality": "empty",
            "structured_has_product_catalog": False,
            "structured_has_organization": False,
            "structured_signal_strength": "none",
            "structured_signals_used": [],
        },
        "clean_text_output": {"text_excerpt": "", "sections": {}},
        "llm_decision_output": {},
        "structured_has_product_catalog": False,
        "structured_has_organization": False,
        "structured_signal_strength": "none",
        "structured_signals_used": [],
        "should_run_shopify_probe": False,
        "relevance_decision": None,
        "relevance_score": None,
        "relevance_reason": None,
        "business_type": None,
        "primary_niche": None,
        "manual_review": False,
        "confidence": 0.0,
        "match_reasons": [],
        "mismatch_reasons": [],
        "signals_used": [],
        "is_finalized": False,
    }


def _safe_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:12]


def _strict_contract_output(final_state: RelevancyAgentState) -> Dict[str, object]:
    llm_output = final_state.get("llm_decision_output") or {}
    if not isinstance(llm_output, dict):
        llm_output = {}

    raw_decision = llm_output.get("relevance_decision", final_state.get("relevance_decision"))
    decision = str(raw_decision).strip().lower() if raw_decision is not None else "unknown"
    if decision not in {"relevant", "irrelevant", "unknown"}:
        decision = "unknown"

    raw_confidence = llm_output.get("confidence", final_state.get("confidence"))
    try:
        confidence = float(raw_confidence)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    reason_raw = llm_output.get("relevance_reason", final_state.get("relevance_reason"))
    reason = str(reason_raw).strip() if reason_raw is not None else ""
    if not reason:
        reason = "No relevance decision available."

    manual_review = bool(llm_output.get("manual_review", final_state.get("manual_review")))
    if decision == "unknown":
        manual_review = True

    return {
        "relevance_decision": decision,
        "manual_review": manual_review,
        "confidence": confidence,
        "relevance_reason": reason,
        "match_reasons": _safe_list(llm_output.get("match_reasons", final_state.get("match_reasons"))),
        "mismatch_reasons": _safe_list(llm_output.get("mismatch_reasons", final_state.get("mismatch_reasons"))),
        "signals_used": _safe_list(llm_output.get("signals_used", final_state.get("signals_used"))),
    }


def _fallback_judge_output(final_state: RelevancyAgentState) -> Dict[str, object]:
    strict_output = _strict_contract_output(final_state)
    strict_output["relevance_decision"] = "unknown"
    strict_output["manual_review"] = True
    strict_output["confidence"] = 0.0
    strict_output["relevance_reason"] = "Fallback decision due to missing or invalid judge output."
    if not strict_output["mismatch_reasons"]:
        strict_output["mismatch_reasons"] = ["Judge output missing required fields."]
    if not strict_output["signals_used"]:
        strict_output["signals_used"] = ["insufficient_signals"]
    return strict_output


def _has_required_contract(output: Dict[str, object]) -> bool:
    required_keys = {
        "relevance_decision",
        "manual_review",
        "confidence",
        "relevance_reason",
        "match_reasons",
        "mismatch_reasons",
        "signals_used",
    }
    return required_keys.issubset(output.keys())


def _fallback_from_final_state(final_state: RelevancyAgentState) -> Dict[str, object]:
    return {
        "relevance_decision": final_state.get("relevance_decision") or "unknown",
        "manual_review": True,
        "confidence": 0.0,
        "relevance_reason": str(final_state.get("relevance_reason") or "No relevance decision available."),
        "match_reasons": [],
        "mismatch_reasons": ["No strict judge output available."],
        "signals_used": _safe_list(final_state.get("signals_used")) or ["insufficient_signals"],
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python _smoke_test_pipeline.py <url> [exporter_profile]")
        return 1

    input_url = _normalize_url(sys.argv[1])
    if not input_url:
        print("Error: URL is required.")
        return 1

    exporter_profile = (
        sys.argv[2]
        if len(sys.argv) >= 3
        else "Find relevant B2B businesses aligned with this exporter profile."
    )
    initial_state = _build_initial_state(input_url, exporter_profile)
    final_state = relevancy_graph.invoke(initial_state)

    output = _strict_contract_output(final_state)
    if not _has_required_contract(output):
        output = _fallback_judge_output(final_state)
    if not output.get("relevance_decision"):
        output = _fallback_from_final_state(final_state)

    print(json.dumps(output, ensure_ascii=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
