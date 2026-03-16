from __future__ import annotations

import concurrent.futures
import logging
import time
from typing import Dict, List, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Hard ceiling on total graph execution time.  The collection node already
# enforces its own sub-page budget; this outer timeout guards against any node
# hanging indefinitely (e.g. a stalled LLM call or a stuck Playwright session).
GRAPH_EXEC_TIMEOUT_S = 300  # 5 minutes

from app.agents.verification.graph import verification_graph
from app.agents.verification.state import VerificationAgentState
from app.db.session import SessionLocal
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession


def _try_mark_verification_failed(business_id: int, reason: str) -> None:
    """
    Best-effort: stamp verification_status='failed' for the given row.

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
                lead.verification_status = "failed"
                lead.verification_reason = reason
                db.commit()
                return  # Written successfully
        except Exception as exc:
            logger.error(
                "_try_mark_verification_failed attempt=%s FAILED business_id=%s error=%s",
                attempt,
                business_id,
                exc,
                exc_info=True,
            )
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            try:
                db.close()
            except Exception:
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


def _build_initial_state(business_id: int) -> VerificationAgentState:
    """
    Opens a fresh DB session, reads the SearchResult row plus its linked
    SearchSession/SearchContext to hydrate every input field, then returns
    a fully-initialised VerificationAgentState.

    All list fields default to [].
    All dict fields default to {}.
    manual_review defaults to False.
    is_finalized defaults to False.
    """
    db = SessionLocal()
    try:
        lead = (
            db.query(SearchResult)
            .filter(SearchResult.result_id == business_id)
            .first()
        )
        if not lead:
            raise ValueError(f"Business ID {business_id} not found in database.")

        custom_prompt: Optional[str] = None
        if lead.search_id:
            session = (
                db.query(SearchSession)
                .filter(SearchSession.search_id == lead.search_id)
                .first()
            )
            if session and session.context:
                custom_prompt = session.context.prompt_text

        return {
            # ---- Input ----
            "business_id": lead.result_id,
            "search_id": lead.search_id,
            "business_name": lead.business_name or _hostname(lead.website or ""),
            "website": _normalize_url(lead.website or ""),
            "address": lead.address,
            "scraped_text_content": lead.scraped_text_content,
            "relevancy_artifacts": lead.relevancy_artifacts or None,
            "custom_prompt": custom_prompt,
            # Relevancy Agent classification — read from DB columns, not artifact blob
            "business_type": lead.business_type,
            "primary_niche": lead.primary_niche,
            # ---- Collection ----
            "website_alive": None,
            "collection_blocked": None,
            "status_code": None,
            "final_url": None,
            "full_site_text": None,
            "contact_page_url": None,
            "wholesale_page_found": None,
            "wholesale_page_url": None,
            # ---- Identity ----
            "company_name_confirmed": None,
            "domain_matches_business": None,
            "domain_match_confidence": None,
            "country_confirmed": None,
            # ---- Contact ----
            "all_emails": [],
            "primary_email": None,
            "email_type": None,
            "email_confidence": None,
            "all_phones": [],
            "whatsapp_number": None,
            "linkedin_company_url": None,
            "social_links": {},
            "contact_form_present": None,
            # ---- Legitimacy ----
            "legitimacy_score": None,
            "has_about_page": None,
            "has_contact_page": None,
            "has_policy_pages": None,
            "has_physical_address": None,
            "domain_age_years": None,
            "ssl_valid": None,
            "risk_flags": [],
            # ---- Business Intelligence ----
            "product_categories": [],
            "product_keywords": [],
            "price_positioning": None,
            "target_customer": None,
            "buys_externally": None,
            "b2b_language_detected": None,
            "company_description": None,
            "brand_tone": None,
            "markets_served": [],
            "ecommerce_enabled": None,
            # ---- Size ----
            "employee_range": None,
            "revenue_band": None,
            # ---- Decision ----
            "verification_status": None,
            "verification_result": None,
            "verification_score": None,
            "verification_confidence": None,
            "verification_reason": None,
            "manual_review": False,
            "contactability_score": None,
            # ---- Email Context ----
            "email_context": None,
            # ---- Internal ----
            "is_finalized": False,
        }
    finally:
        db.close()


def _persist_verification_to_db(
    business_id: int, final_state: VerificationAgentState
) -> None:
    """
    Writes all verification output fields from final_state into the SearchResult row.

    Fields without a dedicated column are serialised into the verification_artifacts
    JSONB blob so that downstream agents and analysts can still inspect them.
    """
    db = SessionLocal()
    try:
        lead = (
            db.query(SearchResult)
            .filter(SearchResult.result_id == business_id)
            .first()
        )
        if not lead:
            return

        lead.verification_status = "completed"

        # ---- Decision fields ----
        lead.verification_result = final_state.get("verification_result")
        lead.verification_score = final_state.get("verification_score")
        lead.verification_confidence = final_state.get("verification_confidence")
        lead.verification_reason = final_state.get("verification_reason")
        lead.manual_review = bool(final_state.get("manual_review", False))
        lead.risk_flags = list(final_state.get("risk_flags") or [])
        lead.contactability_score = final_state.get("contactability_score")

        # ---- Identity fields ----
        lead.company_name_confirmed = final_state.get("company_name_confirmed")
        lead.domain_match_confidence = final_state.get("domain_match_confidence")
        lead.country_confirmed = final_state.get("country_confirmed")

        # ---- Contact fields ----
        lead.all_emails_found = list(final_state.get("all_emails") or [])
        lead.email_found = final_state.get("primary_email")
        lead.email_type = final_state.get("email_type")
        lead.email_score = final_state.get("email_confidence")
        lead.all_phones_found = list(final_state.get("all_phones") or [])
        lead.whatsapp_number = final_state.get("whatsapp_number")
        lead.linkedin_company_url = final_state.get("linkedin_company_url")
        lead.social_links = dict(final_state.get("social_links") or {})
        lead.contact_form_present = final_state.get("contact_form_present")

        # ---- Collection fields ----
        lead.wholesale_page_found = final_state.get("wholesale_page_found")
        lead.wholesale_page_url = final_state.get("wholesale_page_url")

        # ---- Legitimacy fields ----
        lead.legitimacy_score = final_state.get("legitimacy_score")
        lead.has_about_page = final_state.get("has_about_page")
        lead.has_contact_page = final_state.get("has_contact_page")
        lead.has_policy_pages = final_state.get("has_policy_pages")
        lead.domain_age_years = final_state.get("domain_age_years")

        # ---- Size fields ----
        lead.employee_range = final_state.get("employee_range")
        lead.revenue_band = final_state.get("revenue_band")

        # ---- Email context (for Email Agent) ----
        lead.email_context = final_state.get("email_context")

        # ---- Structured artifact blob: fields without a dedicated column ----
        lead.verification_artifacts = {
            # Identity
            "domain_matches_business": final_state.get("domain_matches_business"),
            "final_url": final_state.get("final_url"),
            "website_alive": final_state.get("website_alive"),
            "status_code": final_state.get("status_code"),
            "collection_blocked": final_state.get("collection_blocked"),
            # Legitimacy extras
            "has_physical_address": final_state.get("has_physical_address"),
            "ssl_valid": final_state.get("ssl_valid"),
            # Business intelligence
            "product_categories": list(final_state.get("product_categories") or []),
            "product_keywords": list(final_state.get("product_keywords") or []),
            "price_positioning": final_state.get("price_positioning"),
            "target_customer": final_state.get("target_customer"),
            "buys_externally": final_state.get("buys_externally"),
            "b2b_language_detected": final_state.get("b2b_language_detected"),
            "company_description": final_state.get("company_description"),
            "brand_tone": final_state.get("brand_tone"),
            "markets_served": list(final_state.get("markets_served") or []),
            "ecommerce_enabled": final_state.get("ecommerce_enabled"),
        }

        db.commit()
        logger.info(
            "persist_verification business_id=%s result=%s artifacts_saved=True",
            business_id,
            final_state.get("verification_result"),
        )
    except Exception as exc:
        logger.error(
            "persist_verification FAILED business_id=%s error=%s", business_id, exc, exc_info=True
        )
        db.rollback()
        raise
    finally:
        db.close()


def run_verification_for_business(business_id: int) -> Dict[str, object]:
    """
    Runs the verification graph for a single business and persists the result.

    Guards:
    - Processing lock: skips immediately if the row is already being processed.
    - Relevancy gate: skips if relevance_decision != "relevant".
    - Outer crash net: catches any graph-level exception and marks the row as
      "failed" so callers never receive a silent 500.
    - Persistence crash net: marks the row as "failed" if the DB write itself
      throws, preventing the row from being stuck in "processing" forever.
    """
    # ------------------------------------------------------------------ #
    # Task 1 – Processing lock                                            #
    # ------------------------------------------------------------------ #
    logger.info("verification_service START business_id=%s", business_id)
    lock_db = SessionLocal()
    try:
        lead = (
            lock_db.query(SearchResult)
            .filter(SearchResult.result_id == business_id)
            .with_for_update()
            .first()
        )

        # Fail fast: surface a clear 404 rather than silently no-op.
        if not lead:
            raise ValueError(f"Business ID {business_id} not found in database.")

        if lead.verification_status == "processing":
            logger.info(
                "run_verification SKIP business_id=%s reason=already_processing",
                business_id,
            )
            return {"status": "skipped", "message": "Already processing"}

        # Gate: only run verification on leads the Relevancy Agent approved.
        if lead.relevance_decision != "relevant":
            logger.info(
                "run_verification SKIP business_id=%s reason=not_relevant relevance_decision=%s",
                business_id,
                lead.relevance_decision,
            )
            return {
                "status": "skipped",
                "message": f"Lead is not relevant (relevance_decision={lead.relevance_decision!r})",
            }

        # Stamp as "processing" and wipe all stale fields from any previous run
        # so ghost data cannot contaminate the fresh result.
        lead.verification_status = "processing"
        lead.verification_result = None
        lead.verification_score = None
        lead.verification_confidence = None
        lead.verification_reason = None
        lead.manual_review = False
        lead.risk_flags = []
        lead.email_found = None
        lead.email_score = None
        lead.verification_artifacts = None
        lead.contactability_score = None
        lead.company_name_confirmed = None
        lead.domain_match_confidence = None
        lead.country_confirmed = None
        lead.all_emails_found = []
        lead.all_phones_found = []
        lead.whatsapp_number = None
        lead.linkedin_company_url = None
        lead.social_links = {}
        lead.contact_form_present = None
        lead.wholesale_page_found = None
        lead.wholesale_page_url = None
        lead.legitimacy_score = None
        lead.domain_age_years = None
        lead.employee_range = None
        lead.revenue_band = None
        lead.email_context = None
        lock_db.commit()
        logger.info("verification_service LOCK_ACQUIRED business_id=%s", business_id)
    except ValueError:
        # ValueError is raised intentionally (e.g. business_id not found).
        # Rollback and re-raise without wrapping.
        lock_db.rollback()
        raise
    except Exception as lock_exc:
        logger.error(
            "run_verification lock_write FAILED business_id=%s error=%s",
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
    initial_state = _build_initial_state(business_id)

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as _executor:
            _future = _executor.submit(verification_graph.invoke, initial_state)
            try:
                final_state = _future.result(timeout=GRAPH_EXEC_TIMEOUT_S)
            except concurrent.futures.TimeoutError:
                _future.cancel()
                raise TimeoutError(
                    f"Graph execution exceeded {GRAPH_EXEC_TIMEOUT_S}s hard limit"
                )
    except Exception as graph_exc:
        logger.error(
            "run_verification GRAPH_CRASH business_id=%s error=%s",
            business_id,
            graph_exc,
            exc_info=True,
        )
        _try_mark_verification_failed(
            business_id,
            f"[CRITICAL_FAILURE] Graph execution crashed: {type(graph_exc).__name__}: {graph_exc}",
        )
        raise

    logger.info("verification_service GRAPH_COMPLETE business_id=%s", business_id)

    # ------------------------------------------------------------------ #
    # Task 3 – Persistence crash net                                      #
    # If _persist_verification_to_db throws (DB down, constraint, etc.), #
    # the lead must not remain stuck in "processing" forever.            #
    # ------------------------------------------------------------------ #
    try:
        _persist_verification_to_db(business_id=business_id, final_state=final_state)
    except Exception as persist_exc:
        logger.error(
            "run_verification PERSIST_FAILED business_id=%s error=%s",
            business_id,
            persist_exc,
            exc_info=True,
        )
        _try_mark_verification_failed(
            business_id,
            f"[CRITICAL_FAILURE] persist_failed: {persist_exc}",
        )
        raise

    logger.info(
        "verification_service PERSISTED business_id=%s result=%s score=%s",
        business_id,
        final_state.get("verification_result"),
        final_state.get("verification_score"),
    )

    return {
        "verification_result": final_state.get("verification_result"),
        "verification_score": final_state.get("verification_score"),
        "verification_confidence": final_state.get("verification_confidence"),
        "verification_reason": final_state.get("verification_reason"),
        "manual_review": final_state.get("manual_review"),
        "contactability_score": final_state.get("contactability_score"),
    }


_BATCH_CHUNK_SIZE = 10
_BATCH_CHUNK_SLEEP_S = 2


def run_verification_batch(business_ids: List[int]) -> List[Dict[str, object]]:
    """
    Run verification for a list of business IDs with built-in rate limiting.

    If the list exceeds _BATCH_CHUNK_SIZE, IDs are processed in chunks of
    that size with _BATCH_CHUNK_SLEEP_S seconds sleep between chunks to
    avoid hammering external services (WHOIS, Playwright, LLM).

    Per-item errors are captured in the result list rather than re-raised.
    """
    chunks = [
        business_ids[i : i + _BATCH_CHUNK_SIZE]
        for i in range(0, len(business_ids), _BATCH_CHUNK_SIZE)
    ]
    total_chunks = len(chunks)
    results: List[Dict[str, object]] = []

    for chunk_idx, chunk in enumerate(chunks, 1):
        logger.info(
            "run_verification_batch CHUNK %s/%s ids=%s",
            chunk_idx,
            total_chunks,
            chunk,
        )
        for business_id in chunk:
            try:
                result = run_verification_for_business(business_id)
                results.append({"business_id": business_id, "status": "ok", "result": result})
            except ValueError as exc:
                results.append(
                    {"business_id": business_id, "status": "not_found", "detail": str(exc)}
                )
            except Exception as exc:
                logger.error(
                    "run_verification_batch ITEM_FAILED business_id=%s error=%s",
                    business_id,
                    exc,
                    exc_info=True,
                )
                results.append(
                    {"business_id": business_id, "status": "error", "detail": str(exc)}
                )

        if chunk_idx < total_chunks:
            logger.info(
                "run_verification_batch SLEEP %ss before chunk %s/%s",
                _BATCH_CHUNK_SLEEP_S,
                chunk_idx + 1,
                total_chunks,
            )
            time.sleep(_BATCH_CHUNK_SLEEP_S)

    return results
