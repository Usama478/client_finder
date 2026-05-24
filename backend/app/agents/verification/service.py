from __future__ import annotations

import logging
import multiprocessing
import queue as _queue_module
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from urllib.parse import urlparse

from pydantic import ValidationError

from app.services.serp_enrichment_service import enrich_lead_via_serp

logger = logging.getLogger(__name__)

_PHASE: dict[int, str] = {}
_PHASE_LOCK = threading.Lock()


def _set_phase(business_id: int, phase: str | None) -> None:
    with _PHASE_LOCK:
        if phase is None:
            _PHASE.pop(business_id, None)
        else:
            _PHASE[business_id] = phase


def get_phase(business_id: int) -> str | None:
    with _PHASE_LOCK:
        return _PHASE.get(business_id)


# Hard ceiling on total graph execution time.  The collection node already
# enforces its own sub-page budget; this outer timeout guards against any node
# hanging indefinitely (e.g. a stalled LLM call or a stuck Playwright session).
GRAPH_EXEC_TIMEOUT_S = 300  # 5 minutes

from app.agents.verification.contracts import VerificationFinalContract
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
                _set_phase(business_id, None)
                return  # Written successfully
        except Exception as exc:
            logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(exc)}")
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
    from urllib.parse import urlparse, urlunparse
    value = (url or "").strip()
    if not value:
        return ""
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    parsed = urlparse(value)
    # Strip UTM tracking parameters entirely
    has_utm = any(
        p in (parsed.query or "")
        for p in ("utm_source", "utm_medium", "utm_content", "utm_campaign", "utm_term")
    )
    # Strip tracking-style paths (store locator endpoints, redirect paths)
    path_looks_like_tracking = any(
        seg in parsed.path
        for seg in ("/store/get/", "/kg/", "/redirect", "/track", "/click")
    )
    if has_utm or path_looks_like_tracking:
        # Reduce to root domain only
        return urlunparse((parsed.scheme, parsed.netloc, "", "", "", ""))
    return value


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
            "serp_enrichment": lead.serp_enrichment,
            # ---- Collection ----
            "website_alive": None,
            "accessibility_status": None,
            "collection_blocked": None,
            "status_code": None,
            "final_url": None,
            "full_site_text": None,
            "homepage_html": None,
            "contact_page_url": None,
            "contact_page_html": None,
            "about_page_html": None,
            "homepage_emails": [],
            "wholesale_page_found": None,
            "wholesale_page_url": None,
            "redirect_detected": None,
            "collection_method": None,
            "collection_errors": [],
            # ---- Identity ----
            "company_name_confirmed": None,
            "domain_matches_business": None,
            "domain_match_confidence": None,
            "country_confirmed": None,
            "address_verified": None,
            # ---- Contact ----
            "all_emails": [],
            "primary_email": None,
            "email_type": None,
            "email_confidence": None,
            "email_on_domain": None,
            "free_provider_email": None,
            "outreach_safe_email": False,
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
            "verified_product_catalog": None,
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
            "system_failure": False,
            "system_failure_stage": None,
            "system_failure_reason": None,
            "is_finalized": False,
        }
    finally:
        db.close()


def _persist_verification_to_db(
    business_id: int, final_state: VerificationAgentState
) -> None:
    """
    Writes all verification output fields from final_state into the SearchResult row.

    Validates final_state against VerificationFinalContract before opening a DB
    session.  On ValidationError the row is marked "failed" and the error is
    re-raised so the caller's persistence crash net can handle it cleanly.

    Fields without a dedicated column are serialised into the verification_artifacts
    JSONB blob so that downstream agents and analysts can still inspect them.
    """
    try:
        VerificationFinalContract(
            verification_result=final_state.get("verification_result"),
            verification_score=final_state.get("verification_score") or 0,
            verification_confidence=final_state.get("verification_confidence") or 0.0,
            verification_reason=final_state.get("verification_reason"),
            manual_review=bool(final_state.get("manual_review", False)),
            contactability_score=final_state.get("contactability_score") or 0,
            company_name_confirmed=final_state.get("company_name_confirmed"),
            domain_matches_business=final_state.get("domain_matches_business"),
            domain_match_confidence=final_state.get("domain_match_confidence"),
            country_confirmed=final_state.get("country_confirmed"),
            address_verified=final_state.get("address_verified"),
            primary_email=final_state.get("primary_email"),
            all_emails=list(final_state.get("all_emails") or []),
            email_type=final_state.get("email_type"),
            email_confidence=final_state.get("email_confidence"),
            email_on_domain=final_state.get("email_on_domain"),
            free_provider_email=final_state.get("free_provider_email"),
            outreach_safe_email=bool(final_state.get("outreach_safe_email", False)),
            all_phones=list(final_state.get("all_phones") or []),
            whatsapp_number=final_state.get("whatsapp_number"),
            linkedin_company_url=final_state.get("linkedin_company_url"),
            social_links=dict(final_state.get("social_links") or {}),
            contact_form_present=final_state.get("contact_form_present"),
            contact_page_url=final_state.get("contact_page_url"),
            wholesale_page_found=final_state.get("wholesale_page_found"),
            wholesale_page_url=final_state.get("wholesale_page_url"),
            employee_range=final_state.get("employee_range"),
            revenue_band=final_state.get("revenue_band"),
            legitimacy_score=final_state.get("legitimacy_score"),
            has_about_page=final_state.get("has_about_page"),
            has_contact_page=final_state.get("has_contact_page"),
            has_policy_pages=final_state.get("has_policy_pages"),
            domain_age_years=final_state.get("domain_age_years"),
            ssl_valid=final_state.get("ssl_valid"),
            website_alive=final_state.get("website_alive"),
            accessibility_status=final_state.get("accessibility_status"),
            collection_blocked=final_state.get("collection_blocked"),
            risk_flags=list(final_state.get("risk_flags") or []),
            system_failure=bool(final_state.get("system_failure", False)),
            system_failure_stage=final_state.get("system_failure_stage"),
            system_failure_reason=final_state.get("system_failure_reason"),
            email_context=final_state.get("email_context"),
        )
    except ValidationError as validation_exc:
        logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(validation_exc)}")
        logger.error(
            "persist_verification CONTRACT_VIOLATION business_id=%s error=%s",
            business_id,
            validation_exc,
            exc_info=True,
        )
        _try_mark_verification_failed(
            business_id,
            f"[CONTRACT_VIOLATION] Final state failed contract validation: {validation_exc}",
        )
        raise

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

        # ---- Product catalog (Phase 3 enrichment) ----
        lead.verified_product_catalog = final_state.get("verified_product_catalog")

        # ---- Email context (for Email Agent) ----
        lead.email_context = final_state.get("email_context")

        # ---- Structured artifact blob ----
        lead.verification_artifacts = {
            "accessibility": {
                "website_live": final_state.get("website_alive"),
                "accessibility_status": final_state.get("accessibility_status"),
                "collection_blocked": final_state.get("collection_blocked"),
                "ssl_valid": final_state.get("ssl_valid"),
                "redirect_detected": final_state.get("redirect_detected"),
                "final_url": final_state.get("final_url"),
                "status_code": final_state.get("status_code"),
                "domain_age_years": final_state.get("domain_age_years"),
            },
            "collection": {
                "method": final_state.get("collection_method"),
                "wholesale_page_found": final_state.get("wholesale_page_found"),
                "wholesale_page_url": final_state.get("wholesale_page_url"),
                "contact_page_url": final_state.get("contact_page_url"),
                "errors": final_state.get("collection_errors") or [],
            },
            "contact": {
                "all_emails": final_state.get("all_emails") or [],
                "primary_email": final_state.get("primary_email"),
                "email_type": final_state.get("email_type"),
                "email_confidence": final_state.get("email_confidence"),
                "email_safety": {
                    "email_on_domain": final_state.get("email_on_domain"),
                    "free_provider_email": final_state.get("free_provider_email"),
                    "outreach_safe_email": bool(final_state.get("outreach_safe_email", False)),
                },
                "all_phones": final_state.get("all_phones") or [],
                "whatsapp": final_state.get("whatsapp_number"),
                "linkedin": final_state.get("linkedin_company_url"),
                "social_links": final_state.get("social_links") or {},
                "contact_form_present": final_state.get("contact_form_present"),
            },
            "identity": {
                "company_name_confirmed": final_state.get("company_name_confirmed"),
                "domain_matches": final_state.get("domain_matches_business"),
                "domain_match_confidence": final_state.get("domain_match_confidence"),
                "country": final_state.get("country_confirmed"),
                "address_verified": final_state.get("address_verified"),
            },
            "legitimacy": {
                "score": final_state.get("legitimacy_score"),
                "has_about": final_state.get("has_about_page"),
                "has_contact": final_state.get("has_contact_page"),
                "has_policy": final_state.get("has_policy_pages"),
                "has_address": final_state.get("has_physical_address"),
                "domain_age_years": final_state.get("domain_age_years"),
                "risk_flags": final_state.get("risk_flags") or [],
            },
            "business_intelligence": {
                "product_categories": final_state.get("product_categories") or [],
                "product_keywords": final_state.get("product_keywords") or [],
                "price_positioning": final_state.get("price_positioning"),
                "brand_tone": final_state.get("brand_tone"),
                "markets_served": final_state.get("markets_served") or [],
                "company_description": final_state.get("company_description"),
                "buys_externally": final_state.get("buys_externally"),
                "b2b_language_detected": final_state.get("b2b_language_detected"),
                "target_customer": final_state.get("target_customer"),
                "ecommerce_enabled": final_state.get("ecommerce_enabled"),
            },
            "size": {
                "employee_range": final_state.get("employee_range"),
                "revenue_band": final_state.get("revenue_band"),
            },
            "system": {
                "failure": bool(final_state.get("system_failure", False)),
                "system_error": bool(final_state.get("system_failure", False)),
                "system_risk": bool(final_state.get("system_failure", False)),
                "stage": final_state.get("system_failure_stage"),
                "reason": final_state.get("system_failure_reason"),
            },
            "email_context": final_state.get("email_context") or {},
        }

        db.commit()
        logger.info(
            "persist_verification business_id=%s result=%s artifacts_saved=True",
            business_id,
            final_state.get("verification_result"),
        )
    except Exception as exc:
        logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(exc)}")
        logger.error(
            "persist_verification FAILED business_id=%s error=%s", business_id, exc, exc_info=True
        )
        db.rollback()
        raise
    finally:
        db.close()


def _run_graph_subprocess(
    initial_state: dict,
    result_queue: "multiprocessing.Queue[tuple]",
) -> None:
    """
    Subprocess worker: invokes the verification graph and puts a
    ``("ok", final_state)`` or ``("error", exc)`` tuple into *result_queue*.

    Running the graph in a dedicated subprocess means that
    ``Process.terminate()`` (SIGTERM) physically kills every blocking I/O
    operation — Playwright sessions, WHOIS sockets, LLM HTTP connections —
    when the outer timeout fires.  ``ThreadPoolExecutor`` + ``Future.cancel()``
    cannot do this because ``cancel()`` is a no-op once the thread has started.

    Note: all DB sessions in the parent must be closed *before* the process is
    started so that the fork'd child does not inherit live connection file
    descriptors.  The lock and initial-state queries both close their sessions
    in ``finally`` blocks before this function is called.
    """
    try:
        # Import inside the worker so the module is re-initialised cleanly in
        # the child process (important for non-fork start methods).
        from app.agents.verification.graph import verification_graph  # noqa: PLC0415

        final_state = verification_graph.invoke(initial_state)
        for _heavy_key in (
            "homepage_html",
            "contact_page_html",
            "about_page_html",
            "full_site_text",
            "scraped_text_content",
            "relevancy_artifacts",
        ):
            final_state[_heavy_key] = None
        result_queue.put(("ok", final_state))
    except Exception as exc:  # noqa: BLE001
        try:
            result_queue.put(("error", exc))
        except Exception:
            # Some exceptions are not picklable; wrap them so the queue put
            # never itself raises.
            result_queue.put(("error", RuntimeError(f"{type(exc).__name__}: {exc}")))


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

        logger.info(f"[VERIFICATION] Starting for business_id={business_id} website={lead.website}")

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
        lead.email_type = None
        lead.has_about_page = False
        lead.has_contact_page = False
        lead.has_policy_pages = False
        lead.wholesale_page_found = None
        lead.wholesale_page_url = None
        lead.legitimacy_score = None
        lead.domain_age_years = None
        lead.employee_range = None
        lead.revenue_band = None
        lead.email_context = None
        lead.verified_product_catalog = None
        lock_db.commit()
        logger.info("verification_service LOCK_ACQUIRED business_id=%s", business_id)
        _set_phase(business_id, "Preparing lead")
    except ValueError as exc:
        logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(exc)}")
        # ValueError is raised intentionally (e.g. business_id not found).
        # Rollback and re-raise without wrapping.
        lock_db.rollback()
        raise
    except Exception as lock_exc:
        logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(lock_exc)}")
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
    # Task 1.5 – SERP enrichment (between lock release and graph exec)    #
    # ------------------------------------------------------------------ #
    _set_phase(business_id, "Enriching via web search")
    _enrich_db = SessionLocal()
    try:
        _lead_for_enrich = _enrich_db.query(SearchResult).filter(SearchResult.result_id == business_id).first()
        if _lead_for_enrich and _lead_for_enrich.serp_enrichment is None:
            import asyncio
            import concurrent.futures
            def _run_enrich():
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    new_loop.run_until_complete(enrich_lead_via_serp(business_id, _enrich_db))
                finally:
                    new_loop.close()
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as _pool:
                future = _pool.submit(_run_enrich)
                future.result(timeout=30)
    except Exception as _enrich_exc:
        logger.warning("serp_enrichment FAILED business_id=%s error=%s", business_id, _enrich_exc)
    finally:
        _enrich_db.close()

    # ------------------------------------------------------------------ #
    # Task 2 – Outer crash net around graph execution                     #
    # ------------------------------------------------------------------ #
    initial_state = _build_initial_state(business_id)

    _set_phase(business_id, "Analyzing website")
    logger.info(f"[VERIFICATION] Starting web verification for business_id={business_id}")

    try:
        _result_queue: multiprocessing.Queue = multiprocessing.Queue()
        _process = multiprocessing.Process(
            target=_run_graph_subprocess,
            args=(initial_state, _result_queue),
            daemon=True,
        )
        _process.start()
        _process.join(timeout=GRAPH_EXEC_TIMEOUT_S)

        if _process.is_alive():
            # Hard timeout: SIGTERM terminates the subprocess and all blocking
            # I/O it owns (Playwright, WHOIS, LLM sockets).  Unlike
            # Future.cancel(), this actually stops the work.
            _process.terminate()
            _process.join(timeout=5)
            if _process.is_alive():
                # SIGTERM was ignored (e.g. a C-extension signal mask); escalate.
                _process.kill()
                _process.join(timeout=2)
            raise TimeoutError(
                f"Graph execution exceeded {GRAPH_EXEC_TIMEOUT_S}s hard limit"
            )

        # Subprocess exited normally — retrieve the result.
        try:
            _status, _payload = _result_queue.get(timeout=5)
        except _queue_module.Empty:
            raise RuntimeError(
                f"Graph subprocess exited (code={_process.exitcode}) without returning a result"
            )

        if _status == "error":
            raise _payload  # re-raise the original graph exception

        final_state = _payload
        
        logger.info(f"[VERIFICATION] Website accessible check for business_id={business_id}: {final_state.get('website_alive')}")
        logger.info(f"[VERIFICATION] Contact page found for business_id={business_id}: {final_state.get('has_contact_page')}")
        logger.info(f"[VERIFICATION] Legitimacy score for business_id={business_id}: {final_state.get('legitimacy_score')}")
        logger.info(f"[VERIFICATION] Final decision for business_id={business_id}: status={final_state.get('verification_result')} legitimacy_score={final_state.get('legitimacy_score')} flags={final_state.get('risk_flags')}")
        
    except Exception as graph_exc:
        logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(graph_exc)}")
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
    _set_phase(business_id, "Saving results")
    try:
        _persist_verification_to_db(business_id=business_id, final_state=final_state)
        logger.info(f"[VERIFICATION] Saved to DB: business_id={business_id} verification_status={final_state.get('verification_result')} legitimacy_score={final_state.get('legitimacy_score')}")
    except Exception as persist_exc:
        logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(persist_exc)}")
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

    _set_phase(business_id, None)

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
                logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(exc)}")
                results.append(
                    {"business_id": business_id, "status": "not_found", "detail": str(exc)}
                )
            except Exception as exc:
                logger.error(f"[VERIFICATION] ERROR for business_id={business_id}: {str(exc)}")
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


def reset_stale_processing_leads(max_age_minutes: int = 15) -> int:
    """
    Rescue leads permanently stuck in ``verification_status="processing"``.

    A row can be orphaned in ``"processing"`` when both retry attempts of
    ``_try_mark_verification_failed`` fail (e.g. a DB blip during a graph
    crash).  The processing-lock check in ``run_verification_for_business``
    skips such rows on every subsequent call, leaving them unresolvable.

    This function queries for rows whose ``verification_status`` is still
    ``"processing"`` AND whose ``created_at`` timestamp is older than
    ``max_age_minutes`` minutes, then stamps them as ``"failed"`` so they
    are visible and re-queueable.

    It is intentionally idempotent and safe to call repeatedly (e.g. from
    a cron job, an APScheduler beat task, or a management HTTP endpoint).

    Args:
        max_age_minutes: Minimum age in minutes before a "processing" row is
            considered stale and eligible for reset.  Defaults to 15.

    Returns:
        The number of rows that were reset.

    Raises:
        Exception: Any DB-level exception is logged and re-raised so the
            caller (scheduler or management endpoint) can record the failure
            and retry later.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
    reason = f"[STUCK] processing lock expired after {max_age_minutes}m"

    db = SessionLocal()
    try:
        stale_leads = (
            db.query(SearchResult)
            .filter(
                SearchResult.verification_status == "processing",
                SearchResult.created_at < cutoff,
            )
            .all()
        )

        count = len(stale_leads)
        if count == 0:
            logger.info("reset_stale_processing_leads: no stale rows found (cutoff=%s)", cutoff)
            return 0

        for lead in stale_leads:
            lead.verification_status = "failed"
            lead.verification_reason = reason

        db.commit()
        logger.warning(
            "reset_stale_processing_leads: reset %d stale row(s) older than %dm (cutoff=%s)",
            count,
            max_age_minutes,
            cutoff,
        )
        return count

    except Exception as exc:
        logger.error(
            "reset_stale_processing_leads FAILED max_age_minutes=%s error=%s",
            max_age_minutes,
            exc,
            exc_info=True,
        )
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            db.close()
        except Exception:
            pass
