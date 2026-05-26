from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.campaign import Campaign
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession
from app.services.credit_service import check_credits, deduct_credits

logger = logging.getLogger(__name__)

CREDIT_COSTS = {
    "relevance_agent": 2,
    "verification_agent": 5,
    "serp_enrichment": 1,
    "hunter_email": 3,
    "discovery_pass": 3,
}


def estimate_campaign_cost(target_count: int, platform: str) -> dict:
    relevance_pass_rate = 0.35
    verification_pass_rate = 0.65
    candidates_needed_for_verification = target_count / verification_pass_rate
    total_candidates = candidates_needed_for_verification / relevance_pass_rate
    import math
    estimated_passes = max(1, math.ceil(total_candidates / 20))
    total_relevance_runs = int(total_candidates)
    total_verification_runs = int(candidates_needed_for_verification)
    estimated = (
        estimated_passes * CREDIT_COSTS["discovery_pass"]
        + total_relevance_runs * CREDIT_COSTS["relevance_agent"]
        + total_verification_runs * CREDIT_COSTS["verification_agent"]
        + total_verification_runs * CREDIT_COSTS["serp_enrichment"]
    )
    return {
        "low": int(estimated * 0.8),
        "high": int(estimated * 1.3),
        "breakdown": {
            "estimated_passes": estimated_passes,
            "total_candidates": int(total_candidates),
            "total_relevance_runs": total_relevance_runs,
            "total_verification_runs": total_verification_runs,
        },
    }


def _extract_domain(url: str) -> str:
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        return parsed.netloc.lower().replace("www.", "")
    except Exception:
        return url.lower()


def _append_log(db: Session, campaign: Campaign, message: str, level: str = "info") -> None:
    entry = {
        "time": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message,
    }
    try:
        existing = json.loads(campaign.activity_log or "[]")
    except Exception:
        existing = []
    existing.append(entry)
    campaign.activity_log = json.dumps(existing[-200:])
    campaign.updated_at = datetime.now(timezone.utc)
    db.commit()


def _generate_varied_queries(search_intent: str, previous_queries: list[str], context_text: str = "") -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    context_part = f"\nContext: {context_text}" if context_text else ""
    prev_part = "\n".join(previous_queries[-6:]) if previous_queries else "none"
    prompt = (
        f"The user is looking for: {search_intent}{context_part}\n"
        f"Previous search queries used:\n{prev_part}\n\n"
        "Generate 2 NEW search queries that approach this from a different angle. "
        "Use synonyms, related categories, adjacent niches, or different geographic terms. "
        'Return only JSON: {"maps_queries": ["query1", "query2"], "web_queries": ["query1", "query2"]}'
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


async def _run_discovery_pass(
    campaign: Campaign,
    db: Session,
    pass_number: int,
    maps_query: Optional[str],
    web_query: Optional[str],
    seen_domains: set,
    user_id: int,
) -> list[int]:
    """Run one discovery pass. Returns list of new result_ids."""
    result_ids = []

    if campaign.discovery_platform in ("maps", "both") and maps_query:
        try:
            from app.services.google_maps_service import search_google_maps
            from app.models.search_session import SearchSession
            maps_db = SessionLocal()
            try:
                result = search_google_maps(db=maps_db, user_id=user_id, query=maps_query)
                if result and result.get("search_id"):
                    search_id = result["search_id"]
                    maps_session = maps_db.query(SearchSession).filter(
                        SearchSession.search_id == search_id
                    ).first()
                    if maps_session and maps_session.campaign_id is None:
                        maps_session.campaign_id = campaign.id
                    new_leads = maps_db.query(SearchResult).filter(
                        SearchResult.search_id == search_id
                    ).all()
                    for lead in new_leads:
                        domain = _extract_domain(lead.website or "")
                        if not domain or domain in seen_domains:
                            continue
                        seen_domains.add(domain)
                        lead.campaign_id = campaign.id
                        lead.campaign_status = "pending_relevance"
                        lead.campaign_pass = pass_number
                        maps_db.commit()
                        result_ids.append(lead.result_id)
                    maps_db.commit()
            finally:
                maps_db.close()
        except Exception as e:
            logger.warning(f"[CAMPAIGN {campaign.id}] Maps discovery failed: {e}")

    if campaign.discovery_platform in ("serp", "both") and web_query:
        try:
            from app.services.serp_discovery_service import discover_via_serp
            from app.models.search_session import SearchSession
            from datetime import datetime
            serp_db = SessionLocal()
            try:
                serp_session = SearchSession(
                    user_id=user_id,
                    search_query=web_query,
                    created_at=datetime.utcnow(),
                    discovery_platform="serp",
                    campaign_id=campaign.id,
                )
                serp_db.add(serp_session)
                serp_db.commit()
                serp_db.refresh(serp_session)
                records = await discover_via_serp(
                    web_queries=[web_query],
                    session_id=serp_session.search_id,
                    user_id=user_id,
                    db=serp_db,
                )
                for lead in (records or []):
                    domain = _extract_domain(lead.website or "")
                    if domain in seen_domains:
                        continue
                    seen_domains.add(domain)
                    lead.campaign_id = campaign.id
                    lead.campaign_status = "pending_relevance"
                    lead.campaign_pass = pass_number
                    result_ids.append(lead.result_id)
                serp_db.commit()
            finally:
                serp_db.close()
        except Exception as e:
            logger.warning(f"[CAMPAIGN {campaign.id}] SERP discovery failed: {e}")

    return result_ids


def _run_relevance_sync(result_id: int, context_text: str, search_intent: str, context_id: Optional[int] = None) -> dict:
    from app.agents.relevancy.service_v2 import run_relevancy_v2_for_business
    db = SessionLocal()
    try:
        lead = db.query(SearchResult).filter(SearchResult.result_id == result_id).first()
        if not lead:
            return {}
        parts = []
        if search_intent and search_intent.strip():
            parts.append(f"Search intent: {search_intent.strip()}")
        if context_text and context_text.strip():
            parts.append(f"Buyer context: {context_text.strip()}")
        combined_profile = "\n".join(parts) if parts else search_intent
        return run_relevancy_v2_for_business(
            business_id=result_id,
            website=lead.website or "",
            exporter_profile=combined_profile,
            search_id=lead.search_id or 0,
            business_name=lead.business_name or "",
            category=lead.business_type or "",
            address=lead.address or "",
        )
    finally:
        db.close()


def _run_verification_sync(result_id: int) -> dict:
    from app.agents.verification.service import run_verification_for_business
    return run_verification_for_business(result_id)


def _get_context_text(db: Session, campaign: Campaign) -> str:
    if not campaign.context_id:
        return ""
    try:
        from app.models.search_context import SearchContext
        ctx = db.query(SearchContext).filter(SearchContext.id == campaign.context_id).first()
        if ctx:
            return ctx.prompt_text or ""
    except Exception:
        pass
    return ""


def _build_seen_domains(db: Session, campaign_id: int) -> set:
    seen: set = set()
    for lead in db.query(SearchResult).filter(SearchResult.campaign_id == campaign_id).all():
        domain = _extract_domain(lead.website or "")
        if domain:
            seen.add(domain)
    return seen


def _finalize_campaign(db: Session, campaign: Campaign) -> None:
    campaign.completed_at = datetime.now(timezone.utc)
    if campaign.verified_count >= campaign.target_count:
        campaign.status = "completed"
        _append_log(db, campaign, f"Campaign completed. {campaign.verified_count} verified clients found.")
    elif campaign.credits_used >= campaign.credit_budget:
        campaign.status = "exhausted"
        _append_log(
            db,
            campaign,
            f"Campaign exhausted budget. {campaign.verified_count}/{campaign.target_count} verified.",
        )
    else:
        campaign.status = "completed"
        _append_log(db, campaign, f"Campaign finished. {campaign.verified_count} verified clients found.")
    db.commit()


def _process_candidate(
    db: Session,
    campaign: Campaign,
    lead: SearchResult,
    context_text: str,
    campaign_id: int,
    *,
    relevance_pass_suffix: str = ". Running verification...",
    relevance_error_prefix: str = "Relevance error on",
) -> bool:
    """Run relevance then verification for one lead. Returns True if inner loop should break (credits)."""
    lead.campaign_status = "running_relevance"
    db.commit()
    _append_log(db, campaign, f"Checking relevance: {lead.business_name or lead.website}")

    try:
        output = _run_relevance_sync(
            lead.result_id, context_text, campaign.search_intent, campaign.context_id
        )
        campaign.credits_used += CREDIT_COSTS["relevance_agent"]
        deduct_credits(
            db,
            campaign.user_id,
            CREDIT_COSTS["relevance_agent"],
            "campaign_relevance",
            reference_id=str(campaign_id),
            reference_type="campaign",
        )
        decision = output.get("relevance_decision", "irrelevant")
        score_raw = output.get("confidence", 0)
        score = int(float(score_raw) * 100) if float(score_raw) <= 1 else int(float(score_raw))

        if decision == "relevant" and score >= campaign.relevance_threshold:
            lead.campaign_status = "queued_for_verification"
            campaign.total_relevance_passed += 1
            db.commit()
            _append_log(
                db,
                campaign,
                f"✓ Relevance passed ({score}%) — {lead.business_name}{relevance_pass_suffix}",
            )
        else:
            lead.campaign_status = "rejected_relevance"
            db.commit()
            _append_log(db, campaign, f"✗ Relevance failed ({decision}, {score}%) — {lead.business_name}")
            return False
    except Exception as e:
        lead.campaign_status = "error"
        db.commit()
        if relevance_error_prefix == "Relevance error on":
            _append_log(db, campaign, f"{relevance_error_prefix} {lead.website}: {e}", "error")
        else:
            _append_log(db, campaign, f"{relevance_error_prefix}: {e}", "error")
        return False

    db.refresh(campaign)
    if campaign.credits_used >= campaign.credit_budget:
        _append_log(db, campaign, "Credit budget reached before verification.", "warn")
        return True

    lead.campaign_status = "running_verification"
    db.commit()
    _append_log(db, campaign, f"Verifying: {lead.business_name or lead.website}")

    try:
        v_output = _run_verification_sync(lead.result_id)
        campaign.credits_used += CREDIT_COSTS["verification_agent"] + CREDIT_COSTS["serp_enrichment"]
        deduct_credits(
            db,
            campaign.user_id,
            CREDIT_COSTS["verification_agent"] + CREDIT_COSTS["serp_enrichment"],
            "campaign_verification",
            reference_id=str(campaign_id),
            reference_type="campaign",
        )
        v_result = v_output.get("verification_result", "")
        v_score = v_output.get("verification_score", 0) or 0

        if v_result in ("verified", "strong", "passed") or int(v_score) >= 50:
            lead.campaign_status = "verified"
            campaign.verified_count += 1
            campaign.total_verification_passed += 1
            db.commit()
            _append_log(
                db,
                campaign,
                f"✓✓ VERIFIED: {lead.business_name} (score: {v_score}) [{campaign.verified_count}/{campaign.target_count}]",
            )
        else:
            lead.campaign_status = "rejected_verification"
            db.commit()
            _append_log(db, campaign, f"✗ Verification failed (score: {v_score}) — {lead.business_name}")
    except Exception as e:
        lead.campaign_status = "error"
        db.commit()
        _append_log(db, campaign, f"Verification error on {lead.website}: {e}", "error")

    return False


def run_campaign_resume(campaign_id: int) -> None:
    """Phase 1: drain pending queue. Phase 2: discover until target or credits."""
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            return

        db.query(SearchResult).filter(
            SearchResult.campaign_id == campaign_id,
            SearchResult.campaign_status.in_(["running_relevance", "running_verification"]),
        ).update({"campaign_status": "pending_relevance"}, synchronize_session=False)
        db.commit()

        campaign.status = "running"
        db.commit()
        _append_log(db, campaign, "Resuming campaign — draining discovered queue first.")

        context_text = _get_context_text(db, campaign)

        pending_leads = db.query(SearchResult).filter(
            SearchResult.campaign_id == campaign_id,
            SearchResult.campaign_status == "pending_relevance",
        ).order_by(SearchResult.result_id.asc()).all()

        _append_log(db, campaign, f"Found {len(pending_leads)} unprocessed candidates.")

        for lead in pending_leads:
            db.refresh(campaign)
            if campaign.status == "paused":
                _append_log(db, campaign, "Campaign paused by user.")
                return
            if campaign.credits_used >= campaign.credit_budget:
                _append_log(db, campaign, "Credit budget reached.", "warn")
                break
            if campaign.verified_count >= campaign.target_count:
                break

            if _process_candidate(
                db,
                campaign,
                lead,
                context_text,
                campaign_id,
                relevance_pass_suffix="",
                relevance_error_prefix="Relevance error",
            ):
                break

        db.refresh(campaign)
        if campaign.status == "paused":
            _append_log(db, campaign, "Campaign paused by user.")
            return

        if (
            campaign.verified_count < campaign.target_count
            and campaign.credits_used < campaign.credit_budget
        ):
            _append_log(db, campaign, "Queue drained. Target not yet met. Generating new queries...")

            seen_domains = _build_seen_domains(db, campaign_id)
            previous_queries: list[str] = []
            pass_number = campaign.current_pass or 0

            while (
                campaign.verified_count < campaign.target_count
                and campaign.credits_used < campaign.credit_budget
            ):
                db.refresh(campaign)
                if campaign.status == "paused":
                    _append_log(db, campaign, "Campaign paused by user.")
                    return

                pass_number += 1
                campaign.current_pass = pass_number
                db.commit()

                _append_log(db, campaign, f"Pass {pass_number} starting — generating queries.")

                maps_query = None
                web_query = None
                try:
                    queries = _generate_varied_queries(
                        campaign.search_intent, previous_queries, context_text
                    )
                    maps_query = (queries.get("maps_queries") or [""])[0]
                    web_query = (queries.get("web_queries") or [""])[0]
                    previous_queries.extend([maps_query, web_query])
                    _append_log(
                        db,
                        campaign,
                        f"Pass {pass_number} queries — Maps: '{maps_query}' | Web: '{web_query}'",
                    )
                except Exception as e:
                    _append_log(db, campaign, f"Query generation failed: {e}", "error")
                    campaign.status = "failed"
                    campaign.error_message = f"Query generation failed: {str(e)}"
                    campaign.completed_at = datetime.now(timezone.utc)
                    db.commit()
                    return

                try:
                    new_result_ids = asyncio.run(
                        _run_discovery_pass(
                            campaign,
                            db,
                            pass_number,
                            maps_query,
                            web_query,
                            seen_domains,
                            campaign.user_id,
                        )
                    )
                    campaign.total_discovered += len(new_result_ids)
                    db.commit()
                    _append_log(
                        db,
                        campaign,
                        f"Pass {pass_number} discovered {len(new_result_ids)} new candidates.",
                    )
                except Exception as e:
                    _append_log(db, campaign, f"Discovery failed: {e}", "error")
                    continue

                if not new_result_ids:
                    _append_log(
                        db,
                        campaign,
                        f"Pass {pass_number} found no new candidates. Trying next query variation.",
                    )
                    continue

                campaign.credits_used += CREDIT_COSTS["discovery_pass"]
                deduct_credits(
                    db,
                    campaign.user_id,
                    CREDIT_COSTS["discovery_pass"],
                    "campaign_discovery",
                    reference_id=str(campaign_id),
                    reference_type="campaign",
                )
                db.commit()
                if campaign.credits_used >= campaign.credit_budget:
                    _append_log(db, campaign, "Credit budget reached after discovery.", "warn")
                    break

                for result_id in new_result_ids:
                    db.refresh(campaign)
                    if campaign.status == "paused":
                        _append_log(db, campaign, "Campaign paused by user.")
                        return
                    if campaign.credits_used >= campaign.credit_budget:
                        _append_log(db, campaign, "Credit budget reached.", "warn")
                        break
                    if campaign.verified_count >= campaign.target_count:
                        break

                    lead = db.query(SearchResult).filter(SearchResult.result_id == result_id).first()
                    if not lead:
                        continue

                    if _process_candidate(db, campaign, lead, context_text, campaign_id):
                        break

        _finalize_campaign(db, campaign)

    except Exception as e:
        logger.error(f"[CAMPAIGN_RESUME {campaign_id}] Fatal error: {e}", exc_info=True)
        try:
            db.rollback()
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.status = "failed"
                campaign.error_message = str(e)
                db.commit()
        except Exception as commit_exc:
            logger.error(
                f"[CAMPAIGN_RESUME {campaign_id}] Failed to persist failed status: {commit_exc}",
                exc_info=True,
            )
    finally:
        db.close()


def run_campaign_engine(campaign_id: int) -> None:
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            return

        db.query(SearchResult).filter(
            SearchResult.campaign_id == campaign_id,
            SearchResult.campaign_status.in_(["running_relevance", "running_verification"]),
        ).update({"campaign_status": "pending_relevance"}, synchronize_session=False)
        db.commit()

        check_credits(db, campaign.user_id, CREDIT_COSTS["discovery_pass"])

        campaign.status = "running"
        campaign.started_at = datetime.now(timezone.utc)
        db.commit()

        _append_log(db, campaign, f"Campaign started. Target: {campaign.target_count} verified clients. Budget: {campaign.credit_budget} credits.")

        seen_domains: set = set()
        previous_queries: list[str] = []
        pass_number = 0

        context_text = _get_context_text(db, campaign)

        while campaign.verified_count < campaign.target_count and campaign.credits_used < campaign.credit_budget:
            db.refresh(campaign)
            if campaign.status == "paused":
                _append_log(db, campaign, "Campaign paused by user.")
                return
            pass_number += 1
            campaign.current_pass = pass_number
            db.commit()

            _append_log(db, campaign, f"Pass {pass_number} starting — generating queries.")

            # Generate queries
            maps_query = None
            web_query = None
            try:
                if pass_number == 1:
                    from openai import OpenAI
                    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                    prompt = (
                        f"Generate search queries for finding: {campaign.search_intent}\n"
                        + (f"Context: {context_text}\n" if context_text else "")
                        + 'Return only JSON: {"maps_queries": ["query1"], "web_queries": ["query1"]}'
                    )
                    resp = client.chat.completions.create(
                        model="gpt-4o-mini",
                        max_tokens=200,
                        messages=[{"role": "user", "content": prompt}],
                    )
                    raw = resp.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
                    queries = json.loads(raw)
                else:
                    queries = _generate_varied_queries(campaign.search_intent, previous_queries, context_text)

                maps_query = (queries.get("maps_queries") or [""])[0]
                web_query = (queries.get("web_queries") or [""])[0]
                previous_queries.extend([maps_query, web_query])
                _append_log(db, campaign, f"Pass {pass_number} queries — Maps: '{maps_query}' | Web: '{web_query}'")
            except Exception as e:
                _append_log(db, campaign, f"Query generation failed: {e}", "error")
                campaign.status = "failed"
                campaign.error_message = f"Query generation failed: {str(e)}"
                campaign.completed_at = datetime.now(timezone.utc)
                db.commit()
                return

            # Discovery
            try:
                new_result_ids = asyncio.run(_run_discovery_pass(campaign, db, pass_number, maps_query, web_query, seen_domains, campaign.user_id))
                campaign.total_discovered += len(new_result_ids)
                db.commit()
                _append_log(db, campaign, f"Pass {pass_number} discovered {len(new_result_ids)} new candidates.")
            except Exception as e:
                _append_log(db, campaign, f"Discovery failed: {e}", "error")
                continue

            if not new_result_ids:
                _append_log(db, campaign, f"Pass {pass_number} found no new candidates. Trying next query variation.")
                continue

            campaign.credits_used += CREDIT_COSTS["discovery_pass"]
            deduct_credits(db, campaign.user_id, CREDIT_COSTS["discovery_pass"], "campaign_discovery", reference_id=str(campaign_id), reference_type="campaign")
            db.commit()
            if campaign.credits_used >= campaign.credit_budget:
                _append_log(db, campaign, "Credit budget reached after discovery.", "warn")
                break

            # Combined relevance → verification loop (one candidate at a time)
            for result_id in new_result_ids:
                db.refresh(campaign)
                if campaign.status == "paused":
                    _append_log(db, campaign, "Campaign paused by user.")
                    return
                if campaign.credits_used >= campaign.credit_budget:
                    _append_log(db, campaign, "Credit budget reached.", "warn")
                    break
                if campaign.verified_count >= campaign.target_count:
                    break

                lead = db.query(SearchResult).filter(SearchResult.result_id == result_id).first()
                if not lead:
                    continue

                if _process_candidate(db, campaign, lead, context_text, campaign_id):
                    break

        _finalize_campaign(db, campaign)

    except Exception as e:
        logger.error(f"[CAMPAIGN {campaign_id}] Fatal error: {e}", exc_info=True)
        try:
            db.rollback()
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.status = "failed"
                campaign.error_message = str(e)
                db.commit()
        except Exception as commit_exc:
            logger.error(
                f"[CAMPAIGN {campaign_id}] Failed to persist failed status: {commit_exc}",
                exc_info=True,
            )
    finally:
        db.close()
