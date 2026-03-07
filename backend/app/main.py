from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import (
    search_routes,
    relevancy_routes,
    relevancy_v2_routes,
    verification_routes,
    context_routes,
    dashboard_routes,
    export_routes,
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

app.include_router(search_routes.router)
app.include_router(relevancy_routes.router)
app.include_router(relevancy_v2_routes.router)
app.include_router(verification_routes.router)
app.include_router(context_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(export_routes.router)


@app.get("/")
def health_check():
    return {"status": "Server is running", "step": "1 - Google Maps Ingestion"}
