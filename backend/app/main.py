import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from app.db.session import engine
from app.db.base import Base
from app.api import search_routes, relevancy_routes, verification_routes, context_routes, dashboard_routes, export_routes

app = FastAPI(title="Client Finder MVP")

@app.on_event("startup")
def startup():
    print("🏗️ Connecting to Database...")
    
    # Retry loop: Try to connect 5 times, waiting 2 seconds each time
    retries = 5
    while retries > 0:
        try:
            Base.metadata.create_all(bind=engine)
            print("✅ Tables created! Database connection successful.")
            break
        except OperationalError as e:
            retries -= 1
            print(f"⏳ Database not ready yet. Retrying in 2 seconds... ({retries} attempts left)")
            print(f"Error details: {e}")
            time.sleep(2)
    
    if retries == 0:
        print("❌ Failed to connect to database after multiple attempts.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost", "http://127.0.0.1", "http://localhost:80", "http://127.0.0.1:80"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_routes.router)
app.include_router(relevancy_routes.router)
app.include_router(verification_routes.router)
app.include_router(context_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(export_routes.router)

@app.get("/")
def health_check():
    return {"status": "Server is running", "step": "1 - Google Maps Ingestion"}