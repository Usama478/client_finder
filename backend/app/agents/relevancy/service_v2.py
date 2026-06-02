from __future__ import annotations

import concurrent.futures
import logging
from typing import Dict, Optional
from urllib.parse import urlparse

from app.agents.relevancy.phase_tracker import set_relevance_phase

logger = logging.getLogger(__name__)

# Hard ceiling on total graph execution time.  The collection node already
# enforces a 60 s sub-page budget; this outer timeout guards against any node
# hanging indefinitely (e.g. a stalled LLM call or a stuck Playwright session).
GRAPH_EXEC_TIMEOUT_S = 300  # 5 minutes

from app.agents.relevancy.graph import relevancy_graph
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.utils import safe_list as _safe_list
from app.db.session import SessionLocal
from app.models.search_result import SearchResult


def _try_mark_failed(business_id: int, reason: str) -> None:
    """
    Best-effort: stamp relevance_status='failed' for the given row.

    Tries twice with completely independent sessions so that a transient DB
    hiccup on the first attempt does not permanently leave the row stuck in
    'processing'.  If both attempts fail, the error is logged but NOT
    re-raised — the caller is already in an error path and must not be
    interrupted by a secondary failure here.
    """
    for attempt in range(1, 3):
        db = SessionLocal()
        try:
            lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
            if lead:
                lead.relevance_status = "failed"
                lead.relevance_reason = reason
                db.commit()
                return  # Written successfully
        except Exception as exc:
            logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
            logger.error(
                "_try_mark_failed attempt=%s FAILED business_id=%s error=%s",
                attempt,
                business_id,
                exc,
                exc_info=True,
            )
            try:
                db.rollback()
            except Exception as exc:
                logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
                pass
        finally:
            try:
                db.close()
            except Exception as exc:
                logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
                pass


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


def _build_initial_state(
    business_id: int,
    search_id: int,
    url: str,
    exporter_profile: str,
    business_name: Optional[str] = None,
    category: Optional[str] = None,
    address: Optional[str] = None,
    description: Optional[str] = None,
) -> RelevancyAgentState:
    return {
        "business_id": business_id,
        "search_id": search_id,
        "business_name": business_name or _hostname(url),
        "category": category,
        "website": url,
        "address": address,
        "description": description,
        "exporter_profile": exporter_profile,
        "website_exists": None,
        "is_marketplace": False,
        "is_social_profile": False,
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
        "catalog_intelligence_output": {},
        "business_model_intelligence_output": {},
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


def _strict_contract_output(final_state: RelevancyAgentState) -> Dict[str, object]:
    llm_output = final_state.get("llm_decision_output") or {}
    if not isinstance(llm_output, dict):
        llm_output = {}

    raw_decision = llm_output.get("relevance_decision", final_state.get("relevance_decision"))
    decision = str(raw_decision).strip().lower() if raw_decision is not None else "unknown"
    if decision not in {"relevant", "irrelevant", "unknown", "low_confidence"}:
        decision = "unknown"

    raw_confidence = llm_output.get("confidence", final_state.get("confidence"))
    try:
        confidence = float(raw_confidence)
    except (TypeError, ValueError) as exc:
        business_id = final_state.get("business_id", "unknown")
        logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    reason_raw = llm_output.get("relevance_reason", final_state.get("relevance_reason"))
    reason = str(reason_raw).strip() if reason_raw is not None else ""
    if not reason:
        reason = "No relevance decision available."

    manual_review = bool(llm_output.get("manual_review", final_state.get("manual_review")))
    if decision in {"unknown", "low_confidence"}:
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
    strict_output["relevance_decision"] = "low_confidence"
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
        "relevance_decision": final_state.get("relevance_decision") or "low_confidence",
        "manual_review": True,
        "confidence": 0.0,
        "relevance_reason": str(final_state.get("relevance_reason") or "No relevance decision available."),
        "match_reasons": [],
        "mismatch_reasons": ["No strict judge output available."],
        "signals_used": _safe_list(final_state.get("signals_used")) or ["insufficient_signals"],
    }


def _persist_to_db(business_id: int, final_state: RelevancyAgentState, strict_output: Dict[str, object]) -> None:
    db = SessionLocal()
    try:
        lead = db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
        if not lead:
            return

        lead.relevance_status = "completed"
        lead.relevance_decision = str(strict_output.get("relevance_decision") or "unknown")
        lead.relevance_reason = str(strict_output.get("relevance_reason") or "")
        lead.confidence = float(strict_output.get("confidence") or 0.0)
        lead.manual_review = bool(strict_output.get("manual_review"))
        lead.match_reasons = list(strict_output.get("match_reasons") or [])
        lead.mismatch_reasons = list(strict_output.get("mismatch_reasons") or [])
        lead.signals_used = list(strict_output.get("signals_used") or [])

        if final_state.get("relevance_score") is not None:
            lead.relevance_score = float(final_state.get("relevance_score") or 0.0)

        # Analyst classification fields
        llm_out = final_state.get("llm_decision_output") or {}
        business_type = final_state.get("business_type") or llm_out.get("business_type")
        primary_niche = final_state.get("primary_niche") or llm_out.get("primary_niche")

        # Fallback: extract business_type from business_model_full if LLM missed it
        if not business_type:
            bm = (final_state.get("business_model_intelligence_output") or {})
            primary_model = bm.get("primary_model")
            MODEL_TO_TYPE = {
                "retailer": "Retailer",
                "brand": "Brand",
                "wholesaler": "Wholesaler",
                "manufacturer": "Manufacturer",
                "distributor": "Distributor",
                "marketplace": "Marketplace",
            }
            if primary_model and primary_model.lower() in MODEL_TO_TYPE:
                business_type = MODEL_TO_TYPE[primary_model.lower()]

        # Fallback: derive primary_niche from catalog_intelligence product families
        if not primary_niche:
            cat_out = (final_state.get("catalog_intelligence_output") or {})
            product_families = cat_out.get("product_families") or []
            category_signals = cat_out.get("category_signals") or []
            # Use first meaningful product family or category signal
            candidates = [
                p for p in (product_families + category_signals)
                if p and len(p) < 40
                and not any(x in p.lower() for x in
                    ["opening hours", "information", "locator",
                     "zara", "store", "shop", "route"])
            ]
            if candidates:
                primary_niche = candidates[0].strip().title()

        if business_type and str(business_type).strip() not in ("", "Unknown"):
            lead.business_type = str(business_type).strip()
        if primary_niche and str(primary_niche).strip() not in ("", "Unknown"):
            lead.primary_niche = str(primary_niche).strip()

        # Scrape artifact — clean text for downstream agents to read without re-scraping
        clean_text = (final_state.get("clean_text_output") or {}).get("text_excerpt")
        if clean_text and str(clean_text).strip():
            lead.scraped_text_content = str(clean_text).strip()

        # Structured artifact blob — platform, full intelligence outputs, timeout flag, collection metadata
        collect = final_state.get("collect_sources_output") or {}
        platform_out = final_state.get("platform_detection_output") or {}
        catalog_out = final_state.get("catalog_intelligence_output") or {}
        business_model_out = final_state.get("business_model_intelligence_output") or {}
        structured_out = final_state.get("structured_signals_output") or {}
        collected_errors = collect.get("errors") or []
        lead.relevancy_artifacts = {
            # Collection metadata
            "fetch_method": collect.get("fetch_method"),
            "timeout_hit": any("timeout" in str(e) for e in collected_errors),
            "collect_blocked": bool(final_state.get("collect_blocked")),
            "collect_status_code": final_state.get("collect_status_code"),
            # Platform
            "platform": platform_out.get("platform"),
            # Full catalog intelligence — replaces the former single-field "catalog_mode"
            "catalog_intelligence_full": catalog_out,
            # Full business model intelligence
            "business_model_full": business_model_out,
            # Key structured-signal fields for quick downstream inspection
            "structured_entities": structured_out.get("entities") or [],
            "structured_signal_flags": structured_out.get("signal_flags") or [],
        }

        db.commit()
        logger.info(f"[RELEVANCY] Saved to DB: business_id={business_id} decision={lead.relevance_decision} score={lead.relevance_score}")
        logger.info(
            "persist_relevancy business_id=%s decision=%s artifacts_saved=True",
            business_id,
            strict_output.get("relevance_decision"),
        )
    except Exception as exc:
        logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
        logger.error("persist_relevancy FAILED business_id=%s error=%s", business_id, exc, exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def run_relevancy_v2_for_business(
    business_id: int,
    website: str,
    exporter_profile: str,
    search_id: int = 0,
    business_name: Optional[str] = None,
    category: Optional[str] = None,
    address: Optional[str] = None,
    description: Optional[str] = None,
) -> Dict[str, object]:
    """
    Runs relevancy_graph.invoke(initial_state) and returns strict contract dict.
    Persists decision fields and rich artifacts to DB for the business row.

    Guards:
    - Processing lock: returns immediately if the lead is already being processed.
    - Outer crash net: catches any graph-level exception and marks the lead as
      "failed" in the DB so callers never receive a silent 500.
    """
    logger.info(f"[RELEVANCY] Starting for business_id={business_id} website={website}")
    normalized_website = _normalize_url(website)
    if not normalized_website:
        raise ValueError("website is required")

    # ------------------------------------------------------------------ #
    # Task 1 – Processing lock                                            #
    # ------------------------------------------------------------------ #
    lock_db = SessionLocal()
    try:
        lead = lock_db.query(SearchResult).filter(SearchResult.result_id == business_id).with_for_update().first()

        # Fail fast: if the row doesn't exist there is nothing to process and
        # nothing to persist — surface a clear 404 rather than silently no-op.
        if not lead:
            raise ValueError(f"Business ID {business_id} not found in database.")

        if lead.relevance_status == "processing":
            logger.info(
                "run_relevancy_v2 SKIP business_id=%s reason=already_processing",
                business_id,
            )
            return {"status": "ignored", "message": "Already processing"}

        # Stamp the row as "processing" before the graph starts so that any
        # concurrent caller hitting this guard will see the lock immediately.
        # Also wipe all stale data from a previous run so it cannot contaminate
        # the fresh result: artifact fields, classification fields, and every
        # decision field that _persist_to_db will later overwrite.
        lead.relevance_status = "processing"
        # Artifact / classification fields
        lead.scraped_text_content = None
        lead.relevancy_artifacts = None
        lead.business_type = None
        lead.primary_niche = None
        # Decision fields — including reason so no ghost string survives
        lead.relevance_decision = None
        lead.relevance_reason = None
        lead.relevance_score = None
        lead.confidence = None
        lead.manual_review = False
        lead.match_reasons = []
        lead.mismatch_reasons = []
        lead.signals_used = []
        lock_db.commit()
    except ValueError as exc:
        logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
        # ValueError is raised intentionally (e.g. business_id not found).
        # Rollback any partial work and re-raise without logging an error.
        lock_db.rollback()
        raise
    except Exception as lock_exc:
        exc = lock_exc
        logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
        logger.error(
            "run_relevancy_v2 lock_write FAILED business_id=%s error=%s",
            business_id,
            lock_exc,
            exc_info=True,
        )
        lock_db.rollback()
        raise
    finally:
        lock_db.close()

    # ------------------------------------------------------------------ #
    # Task 2 – Outer crash net around graph execution                     #
    # ------------------------------------------------------------------ #
    initial_state = _build_initial_state(
        business_id=business_id,
        search_id=search_id,
        url=normalized_website,
        exporter_profile=exporter_profile,
        business_name=business_name,
        category=category,
        address=address,
        description=description,
    )

    try:
        set_relevance_phase(business_id, "Starting relevance check")
        logger.info(f"[RELEVANCY] Invoking LLM graph for business_id={business_id}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as _executor:
            _future = _executor.submit(relevancy_graph.invoke, initial_state)
            try:
                final_state = _future.result(timeout=GRAPH_EXEC_TIMEOUT_S)
            except concurrent.futures.TimeoutError as exc:
                logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
                # The underlying thread continues running (Python cannot force-
                # kill it), but we stop waiting and mark the row as failed so
                # it is never stuck in "processing" from the caller's view.
                _future.cancel()
                raise TimeoutError(
                    f"Graph execution exceeded {GRAPH_EXEC_TIMEOUT_S}s hard limit"
                )
    except Exception as graph_exc:
        exc = graph_exc
        logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
        logger.error(
            "run_relevancy_v2 GRAPH_CRASH business_id=%s error=%s",
            business_id,
            graph_exc,
            exc_info=True,
        )
        set_relevance_phase(business_id, None)
        _try_mark_failed(
            business_id,
            f"[CRITICAL_FAILURE] Graph execution crashed: {type(graph_exc).__name__}: {graph_exc}",
        )
        raise

    output = _strict_contract_output(final_state)
    if not _has_required_contract(output):
        output = _fallback_judge_output(final_state)
    if not output.get("relevance_decision"):
        output = _fallback_from_final_state(final_state)

    decision = output.get("relevance_decision", "unknown")
    score = final_state.get("relevance_score", 0.0)
    reason = str(output.get("relevance_reason", ""))
    logger.info(f"[RELEVANCY] Decision for business_id={business_id}: decision={decision} score={score} reason={reason[:80]}")

    # ------------------------------------------------------------------ #
    # Persistence crash net                                               #
    # If _persist_to_db throws (DB down, constraint, serialization error),#
    # the lead must not remain stuck in "processing" forever.            #
    # ------------------------------------------------------------------ #
    try:
        _persist_to_db(business_id=business_id, final_state=final_state, strict_output=output)
    except Exception as persist_exc:
        exc = persist_exc
        logger.error(f"[RELEVANCY] ERROR for business_id={business_id}: {str(exc)}")
        logger.error(
            "run_relevancy_v2 PERSIST_FAILED business_id=%s error=%s",
            business_id,
            persist_exc,
            exc_info=True,
        )
        set_relevance_phase(business_id, None)
        _try_mark_failed(
            business_id,
            f"[CRITICAL_FAILURE] persist_failed: {persist_exc}",
        )
        raise

    set_relevance_phase(business_id, None)
    return output


def rescore_relevancy_v2_for_business(
    business_id: int,
    exporter_profile: str,
) -> Dict[str, object]:
    """
    Re-runs only the LLM judge using cached scraped_text_content.
    Skips all collection nodes. Sets relevance fields only.
    
    Guards:
    - Processing lock: returns immediately if the lead is already being processed.
    - Requires scraped_text_content to be present.
    """
    logger.info(f"[RELEVANCY_RESCORE] Starting for business_id={business_id}")
    
    # ------------------------------------------------------------------ #
    # Task 1 – Processing lock and data fetch                            #
    # ------------------------------------------------------------------ #
    lock_db = SessionLocal()
    try:
        lead = lock_db.query(SearchResult).filter(SearchResult.result_id == business_id).with_for_update().first()
        
        if not lead:
            raise ValueError(f"Business ID {business_id} not found in database.")
        
        if lead.relevance_status == "processing":
            logger.info(
                "rescore_relevancy_v2 SKIP business_id=%s reason=already_processing",
                business_id,
            )
            return {"status": "ignored", "message": "Already processing"}
        
        if not lead.scraped_text_content:
            raise ValueError(f"Business ID {business_id} has no scraped_text_content to rescore.")
        
        # Capture data needed for judge
        website = lead.website or ""
        business_name = lead.business_name or ""
        address = lead.address or ""
        scraped_text = lead.scraped_text_content
        search_id = lead.search_id
        artifacts = lead.relevancy_artifacts or {}
        
        # Stamp as processing and clear old relevance fields
        lead.relevance_status = "processing"
        lead.relevance_decision = None
        lead.relevance_reason = None
        lead.relevance_score = None
        lead.confidence = None
        lead.manual_review = False
        lead.match_reasons = []
        lead.mismatch_reasons = []
        lead.signals_used = []
        lead.business_type = None
        lead.primary_niche = None
        lock_db.commit()
    except ValueError as exc:
        logger.error(f"[RELEVANCY_RESCORE] ERROR for business_id={business_id}: {str(exc)}")
        lock_db.rollback()
        raise
    except Exception as lock_exc:
        logger.error(f"[RELEVANCY_RESCORE] ERROR for business_id={business_id}: {str(lock_exc)}")
        lock_db.rollback()
        raise
    finally:
        lock_db.close()
    
    # ------------------------------------------------------------------ #
    # Task 2 – Build minimal state and run judge only                    #
    # ------------------------------------------------------------------ #
    from app.agents.relevancy.tools_v2.judge import run_llm_judge
    
    # Build minimal state with cached content
    minimal_state = {
        "business_id": business_id,
        "search_id": search_id,
        "business_name": business_name,
        "website": website,
        "address": address,
        "exporter_profile": exporter_profile,
        "clean_text_output": {"text_excerpt": scraped_text, "sections": {}},
        # Inject cached intelligence from relevancy_artifacts so the LLM judge
        # has the same rich signals as a full run, without re-crawling.
        "catalog_intelligence_output": artifacts.get("catalog_intelligence_full") or {},
        "business_model_intelligence_output": artifacts.get("business_model_full") or {},
        "platform_detection_output": {
            "platform": artifacts.get("platform") or "unknown",
            "confidence": 0.0,
        },
        "structured_signals_output": {
            "entities": artifacts.get("structured_entities") or [],
            "signal_flags": artifacts.get("structured_signal_flags") or [],
            "strong_signal": False,
        },
    }
    
    try:
        logger.info(f"[RELEVANCY_RESCORE] Running LLM judge for business_id={business_id}")
        judge_output = run_llm_judge(minimal_state)
        
        # Extract decision from judge output
        strict_output = {
            "relevance_decision": judge_output.get("relevance_decision", "unknown"),
            "manual_review": judge_output.get("manual_review", True),
            "confidence": judge_output.get("confidence", 0.0),
            "relevance_reason": judge_output.get("relevance_reason", ""),
            "match_reasons": _safe_list(judge_output.get("match_reasons")),
            "mismatch_reasons": _safe_list(judge_output.get("mismatch_reasons")),
            "signals_used": _safe_list(judge_output.get("signals_used")),
        }
        
        # Build final state for persistence
        final_state = {**minimal_state, "llm_decision_output": judge_output}
        
    except Exception as judge_exc:
        logger.error(f"[RELEVANCY_RESCORE] ERROR for business_id={business_id}: {str(judge_exc)}")
        _try_mark_failed(
            business_id,
            f"[RESCORE_FAILURE] Judge execution crashed: {type(judge_exc).__name__}: {judge_exc}",
        )
        raise
    
    # ------------------------------------------------------------------ #
    # Task 3 – Persist only relevance fields                             #
    # ------------------------------------------------------------------ #
    try:
        persist_db = SessionLocal()
        try:
            lead = persist_db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
            if not lead:
                return strict_output
            
            lead.relevance_status = "completed"
            lead.relevance_decision = str(strict_output.get("relevance_decision") or "unknown")
            lead.relevance_reason = str(strict_output.get("relevance_reason") or "")
            lead.confidence = float(strict_output.get("confidence") or 0.0)
            lead.manual_review = bool(strict_output.get("manual_review"))
            lead.match_reasons = list(strict_output.get("match_reasons") or [])
            lead.mismatch_reasons = list(strict_output.get("mismatch_reasons") or [])
            lead.signals_used = list(strict_output.get("signals_used") or [])
            
            # Extract business_type and primary_niche from judge output
            business_type = judge_output.get("business_type")
            primary_niche = judge_output.get("primary_niche")
            
            if business_type and str(business_type).strip() not in ("", "Unknown"):
                lead.business_type = str(business_type).strip()
            if primary_niche and str(primary_niche).strip() not in ("", "Unknown"):
                lead.primary_niche = str(primary_niche).strip()
            
            persist_db.commit()
            logger.info(f"[RELEVANCY_RESCORE] Saved to DB: business_id={business_id} decision={lead.relevance_decision}")
        except Exception as persist_exc:
            logger.error(f"[RELEVANCY_RESCORE] ERROR for business_id={business_id}: {str(persist_exc)}")
            persist_db.rollback()
            raise
        finally:
            persist_db.close()
    except Exception as persist_exc:
        logger.error(f"[RELEVANCY_RESCORE] ERROR for business_id={business_id}: {str(persist_exc)}")
        _try_mark_failed(
            business_id,
            f"[RESCORE_FAILURE] persist_failed: {persist_exc}",
        )
        raise
    
    return strict_output
