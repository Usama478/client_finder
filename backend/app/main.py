from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)

app = FastAPI(title="Client Finder MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:80",
        "http://127.0.0.1:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    body_bytes = await request.body()
    body_str = body_bytes.decode('utf-8')
    
    logger.error(f"[VALIDATION_ERROR] Path: {request.url.path}")
    logger.error(f"[VALIDATION_ERROR] Raw body: {body_str}")
    logger.error(f"[VALIDATION_ERROR] Error details: {exc.errors()}")
    
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body_received": body_str}
    )

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


@app.get("/")
def health_check():
    return {"status": "Server is running", "step": "1 - Google Maps Ingestion"}
