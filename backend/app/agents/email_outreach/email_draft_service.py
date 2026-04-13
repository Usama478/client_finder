from __future__ import annotations

import logging
import time
from typing import Dict, List

from app.agents.email_outreach.draft_generator import (
    build_email_strategy,
    generate_email_draft,
)
from app.agents.email_outreach.pre_checks import check_lead_is_emailable
from app.db.session import SessionLocal
from app.models.email_draft import EmailDraft
from app.models.exporter_profile import ExporterProfile
from app.models.search_result import SearchResult
from app.models.search_session import SearchSession

logger = logging.getLogger(__name__)


def _get_exporter_profile(user_id: int, search_id: int, db) -> object | None:
    """
    Resolve the exporter profile for a given user and search session.

    Preference order:
    1. Profile pinned to the SearchSession (session.exporter_profile_id).
    2. The user's default profile (is_default=True).
    3. None if neither exists.
    """
    try:
        session = (
            db.query(SearchSession)
            .filter(SearchSession.search_id == search_id)
            .first()
        )
        if session is not None and session.exporter_profile_id is not None:
            return (
                db.query(ExporterProfile)
                .filter(ExporterProfile.id == session.exporter_profile_id)
                .first()
            )
        return (
            db.query(ExporterProfile)
            .filter(
                ExporterProfile.user_id == user_id,
                ExporterProfile.is_default == True,  # noqa: E712
            )
            .first()
        )
    except Exception:
        return None


def generate_draft_for_lead(
    business_id: int,
    user_id: int,
    sequence_position: int = 1,
    user_instructions: str = "",
) -> dict:
    """
    Generate (or attempt to generate) an email draft for a single lead.

    A DB row in email_drafts is created for every invocation — success or
    failure — so that all outcomes are visible in the admin UI.

    Returns a dict with keys:
    - {"status": "skipped", "reason": str, "skip_code": str}
    - {"status": "failed",  "reason": str, "draft_id": int}
    - {"status": "created", "draft_id": int, "subject": str}
    """
    logger.info(
        "email_draft START business_id=%s position=%s",
        business_id,
        sequence_position,
    )

    db = SessionLocal()
    try:
        # ------------------------------------------------------------------ #
        # Step 2 – Fetch the lead row                                         #
        # ------------------------------------------------------------------ #
        lead = (
            db.query(SearchResult)
            .filter(SearchResult.result_id == business_id)
            .first()
        )
        if lead is None:
            raise ValueError(f"Business ID {business_id} not found in database.")

        # ------------------------------------------------------------------ #
        # Step 3 – Resolve exporter profile                                   #
        # ------------------------------------------------------------------ #
        profile = _get_exporter_profile(user_id, lead.search_id, db)
        if profile is None:
            logger.info(
                "email_draft SKIPPED business_id=%s reason=no_profile",
                business_id,
            )
            return {
                "status": "skipped",
                "reason": "no exporter profile configured",
                "skip_code": "no_profile",
            }

        # ------------------------------------------------------------------ #
        # Step 4 – Pre-flight emailable check                                 #
        # ------------------------------------------------------------------ #
        check_result = check_lead_is_emailable(lead, sequence_position, profile.id, db)
        if not check_result["ok"]:
            logger.info(
                "email_draft SKIPPED business_id=%s reason=%s",
                business_id,
                check_result["skip_code"],
            )
            return {
                "status": "skipped",
                "reason": check_result["reason"],
                "skip_code": check_result["skip_code"],
            }

        # ------------------------------------------------------------------ #
        # Step 5 – Read email context                                         #
        # ------------------------------------------------------------------ #
        email_context = lead.email_context or {}

        # ------------------------------------------------------------------ #
        # Step 6 – LLM generation (strategy → draft)                         #
        # ------------------------------------------------------------------ #
        try:
            strategy = build_email_strategy(email_context, profile, sequence_position, user_instructions)
            draft_content = generate_email_draft(
                strategy, email_context, profile, sequence_position, user_instructions
            )
        except Exception as e:
            draft_content = {"subject": None, "body": None, "error": str(e)}
            strategy = {}

        # ------------------------------------------------------------------ #
        # Step 7 – Persist EmailDraft record (always, regardless of outcome)  #
        # ------------------------------------------------------------------ #
        if draft_content.get("error") is None:
            status = "pending_review"
            subject = draft_content["subject"]
            body = draft_content["body"]
        else:
            status = "failed"
            subject = None
            body = None

        draft_record = EmailDraft(
            business_id=business_id,
            exporter_profile_id=profile.id,
            sequence_position=sequence_position,
            status=status,
            subject=subject,
            body=body,
            strategy=strategy,
            generation_model="gpt-4o-mini",
            generation_error=draft_content.get("error"),
        )
        db.add(draft_record)
        db.commit()

        # ------------------------------------------------------------------ #
        # Step 8 – Return failure result if generation failed                 #
        # ------------------------------------------------------------------ #
        if status == "failed":
            logger.error(
                "email_draft FAILED business_id=%s error=%s",
                business_id,
                draft_content["error"],
            )
            return {
                "status": "failed",
                "reason": draft_content["error"],
                "draft_id": draft_record.id,
            }

        # ------------------------------------------------------------------ #
        # Step 9 – Success                                                    #
        # ------------------------------------------------------------------ #
        logger.info(
            "email_draft CREATED business_id=%s draft_id=%s",
            business_id,
            draft_record.id,
        )
        return {
            "status": "created",
            "draft_id": draft_record.id,
            "subject": draft_content["subject"],
        }

    finally:
        db.close()


def generate_batch_for_session(
    search_id: int,
    user_id: int,
    sequence_position: int = 1,
) -> Dict[str, object]:
    """
    Generate email drafts for every verified lead in a search session.

    Only leads with a non-null, non-"failed" verification_result are included.
    Results are collected into created / skipped / failed buckets.
    """
    db = SessionLocal()
    try:
        leads: List[SearchResult] = (
            db.query(SearchResult)
            .filter(
                SearchResult.search_id == search_id,
                SearchResult.verification_result.isnot(None),
                SearchResult.verification_result != "failed",
            )
            .all()
        )
        lead_ids: List[int] = [lead.result_id for lead in leads]
    finally:
        db.close()

    created_ids: List[int] = []
    skipped_ids: List[int] = []
    failed_ids: List[int] = []

    for idx, business_id in enumerate(lead_ids):
        result = generate_draft_for_lead(business_id, user_id, sequence_position)

        if result["status"] == "created":
            created_ids.append(result["draft_id"])
        elif result["status"] == "skipped":
            skipped_ids.append(business_id)
        elif result["status"] == "failed":
            failed_ids.append(result.get("draft_id", business_id))

        if idx < len(lead_ids) - 1:
            time.sleep(1)

    return {
        "total": len(lead_ids),
        "created": len(created_ids),
        "created_ids": created_ids,
        "skipped": len(skipped_ids),
        "skipped_ids": skipped_ids,
        "failed": len(failed_ids),
        "failed_ids": failed_ids,
    }
