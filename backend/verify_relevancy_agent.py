import argparse
import os
import sys

# Ensure backend module is found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.models.search_session import SearchSession
from app.models.search_result import SearchResult
from app.agents.relevancy.runner import run_relevancy_agent

try:
    from app.models.user import User
except ImportError:
    User = None


# Use SQLite for standalone verification
# This creates a fresh in-memory DB every time you run it
engine = create_engine("sqlite:///:memory:")
SessionLocal = sessionmaker(bind=engine)


def ensure_user_exists(db, user_id: int) -> None:
    """
    Create a test user only if the user model exists and this user ID is missing.
    user_id is always provided by caller context (request/session/cli argument).
    """
    if User is None:
        return

    existing_user = db.query(User).filter(User.user_id == user_id).first()
    if existing_user:
        return

    user = User(
        user_id=user_id,
        name=f"Test User {user_id}",
        email=f"test_{user_id}@example.com",
        password_hash="xxx",
    )
    db.add(user)
    db.commit()


def verify(user_id: int) -> None:
    print("Setting up verification environment (SQLite)...")

    Base.metadata.create_all(engine)
    db = SessionLocal()

    try:
        ensure_user_exists(db, user_id)

        # Create a test search session using the caller-provided user context.
        session = SearchSession(
            search_query="Leather Jacket Wholesalers",
            user_id=user_id,
            search_location="Milan",
        )
        db.add(session)
        db.commit()

        lead = SearchResult(
            place_id="test_place_python",
            user_id=user_id,
            search_id=session.search_id,
            business_name="Python Software Foundation",
            website="https://www.python.org",
            raw_data={"category": "Non-profit", "description": "Python Programming Language"},
            relevance_status="pending",
        )
        db.add(lead)
        db.commit()

        print(f"Created Test Lead: {lead.business_name} ({lead.website})")
        print(f"Criteria: {session.search_query}")

        print("\nRunning Relevancy Agent...")
        run_relevancy_agent(db, lead.result_id)

        db.refresh(lead)
        print("\nVerification Results:")
        print(f"   - Relevance Status: {lead.relevance_status}")
        print(f"   - Relevance Decision: {lead.relevance_decision}")
        print(f"   - Score: {lead.relevance_score}")
        print(f"   - Business Type: {lead.business_type}")
        print(f"   - Primary Niche: {lead.primary_niche}")
        print(f"   - Reason: {lead.relevance_reason}")

        # Validation logic for this sample.
        if lead.relevance_decision == "irrelevant" or (lead.relevance_score or 0) < 50:
            print("\nSUCCESS: Agent identified Python.org as irrelevant to leather wholesalers.")
        else:
            print("\nNOTICE: Agent marked it relevant. Review the reasoning above.")

    except Exception as e:
        print(f"\nVerification failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a local relevancy agent verification.")
    parser.add_argument(
        "--user-id",
        type=int,
        required=True,
        help="User ID from request/session context.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        print("WARNING: OPENAI_API_KEY not found. Agent might fail at analyst step.")

    args = parse_args()
    verify(user_id=args.user_id)
