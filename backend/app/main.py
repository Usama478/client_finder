import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.api import (
    search_routes,
    relevancy_v2_routes,
    verification_routes,
    context_routes,
    dashboard_routes,
    export_routes,
    sendgrid_webhook_routes,
    email_routes,
    auth_routes,
    exporter_profile_routes,
    contacts_routes,
    admin_routes,
    leads_routes,
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging
import redis as redis_lib

from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from app.agents.verification.service import reset_stale_processing_leads
from app.db.session import SessionLocal
from app.models.campaign import Campaign
from app.models.search_result import SearchResult

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)

_SCHEDULER_LOCK_KEY = "scheduler_leader"
_SCHEDULER_LOCK_TTL_MS = 660_000  # 11 min — slightly longer than the 10-min job interval


def _try_acquire_scheduler_lock() -> bool:
    """Return True if this process wins the scheduler-leader election.

    Uses Redis SET NX so that only one uvicorn worker process (out of N spawned
    by --workers N) runs the BackgroundScheduler. The lock has an 11-minute TTL
    so it auto-expires if the leader worker crashes without releasing it.
    """
    try:
        r = redis_lib.from_url(os.getenv("REDIS_URL", "redis://redis:6379/2"))
        acquired = r.set(_SCHEDULER_LOCK_KEY, os.getpid(), nx=True, px=_SCHEDULER_LOCK_TTL_MS)
        r.close()
        return bool(acquired)
    except Exception as exc:
        logger.warning("scheduler lock check failed (%s); starting scheduler anyway", exc)
        return True


def _reset_stale_job() -> None:
    try:
        count = reset_stale_processing_leads(max_age_minutes=15)
        if count:
            logger.warning("scheduler: reset %d stale verification row(s)", count)
    except Exception as exc:
        logger.error("scheduler: reset_stale_processing_leads failed: %s", exc)


def _recover_crashed_campaigns() -> None:
    """Reset campaigns/leads stuck in running states after an unclean shutdown."""
    recovery_db = SessionLocal()
    try:
        stuck_campaigns = recovery_db.query(Campaign).filter(Campaign.status == "running").all()
        for campaign in stuck_campaigns:
            campaign.status = "paused"

        relevance_reset = recovery_db.query(SearchResult).filter(
            SearchResult.campaign_status == "running_relevance"
        ).update({"campaign_status": "pending_relevance"}, synchronize_session=False)

        verification_reset = recovery_db.query(SearchResult).filter(
            SearchResult.campaign_status == "running_verification"
        ).update({"campaign_status": "queued_for_verification"}, synchronize_session=False)

        recovery_db.commit()
        logger.info(
            "startup recovery: %d campaigns paused, %d relevance reset, %d verification reset",
            len(stuck_campaigns),
            relevance_reset,
            verification_reset,
        )
    except Exception as exc:
        logger.error("startup recovery failed: %s", exc)
        recovery_db.rollback()
    finally:
        recovery_db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        count = reset_stale_processing_leads(max_age_minutes=0)
        if count:
            logger.warning("startup: reset %d stale verification row(s)", count)
    except Exception as exc:
        logger.error("startup: reset_stale_processing_leads failed: %s", exc)

    _recover_crashed_campaigns()

    scheduler = None
    if _try_acquire_scheduler_lock():
        scheduler = BackgroundScheduler()
        scheduler.add_job(_reset_stale_job, "interval", minutes=10, id="reset_stale")
        scheduler.start()
        logger.info("startup: stale-verification scheduler started (interval=10m, pid=%d)", os.getpid())
    else:
        logger.info("startup: scheduler lock held by another worker; skipping scheduler (pid=%d)", os.getpid())

    yield

    # Shutdown
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        logger.info("shutdown: stale-verification scheduler stopped")

app = FastAPI(title="Client Finder MVP", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = os.getenv("FRONTEND_URL", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    field_names = []
    for error in exc.errors():
        loc = error.get("loc", ())
        if loc:
            field_names.append(".".join(str(part) for part in loc))

    logger.error(
        "[VALIDATION_ERROR] Path: %s Fields: %s",
        request.url.path,
        field_names,
    )

    safe_errors = []
    for error in exc.errors():
        safe_error = {k: str(v) if k == "ctx" else v for k, v in error.items() if k != "input"}
        safe_errors.append(safe_error)

    return JSONResponse(
        status_code=422,
        content={"detail": safe_errors}
    )

@app.get("/health")
async def health_check():
    return {"status": "ok"}

app.include_router(search_routes.router)
app.include_router(relevancy_v2_routes.router)
app.include_router(verification_routes.router)
app.include_router(context_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(export_routes.router)
app.include_router(sendgrid_webhook_routes.router)
app.include_router(email_routes.router)
app.include_router(auth_routes.router)
app.include_router(exporter_profile_routes.router)
app.include_router(contacts_routes.router)
app.include_router(admin_routes.router)
app.include_router(leads_routes.router, prefix="/api/v1/leads")
from app.api.routes import campaign_routes
app.include_router(campaign_routes.router)


@app.get("/")
def health_check():
    return {"status": "Server is running", "step": "1 - Google Maps Ingestion"}
