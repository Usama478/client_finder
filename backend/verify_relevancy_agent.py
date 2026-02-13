import os
import sys

# Ensure backend module is found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base

# Import all models to ensure tables are created
from app.models.search_session import SearchSession
from app.models.search_result import SearchResult
# Attempt to import User, if it fails we might need to mock or finding it
try:
    from app.models.user import User
except ImportError:
    pass

from app.agents.relevancy.runner import run_relevancy_agent

# Use SQLite for standalone verification
# This creates a fresh in-memory DB every time you run it
engine = create_engine("sqlite:///:memory:")
SessionLocal = sessionmaker(bind=engine)

def verify():
    print("🔬 Setting up Verification Environment (SQLite)...")
    
    # Create Tables
    Base.metadata.create_all(engine)
    db = SessionLocal()

    try:
        # 1. Create Dummy User (Needed for Foreign Keys)
        # We try to insert a user if the table exists
        try:
            user = User(email="test@example.com", hashed_password="xxx")
            db.add(user)
            db.commit()
            user_id = user.user_id
        except NameError:
            # If User model wasn't imported/found, maybe we don't need it if FK constraints aren't enforced in SQLite by default?
            # actually SQLite enforces FKs if enabled, but usually off by default in older libs.
            # But let's assume we need a user ID.
            user_id = 1
        except Exception:
            user_id = 1

        # 2. Create Dummy Search Session
        ss = SearchSession(
            search_query="Leather Jacket Wholesalers",
            user_id=user_id,
            search_location="Milan"
        )
        db.add(ss)
        db.commit()

        # 3. Create Dummy Lead (Target: Python.org as a test case for 'Software' vs 'Leather')
        # This checks if the agent correctly identifies it's NOT a Leather Wholesaler.
        lead = SearchResult(
            place_id="test_place_python",
            user_id=user_id,
            search_id=ss.search_id,
            business_name="Python Software Foundation",
            website="https://www.python.org",
            raw_data={"category": "Non-profit", "description": "Python Programming Language"},
            relevance_status="pending"
        )
        db.add(lead)
        db.commit()
        
        print(f"📍 Created Test Lead: {lead.business_name} ({lead.website})")
        print(f"🎯 Criteria: {ss.search_query}")

        # 4. Run Agent
        print("\n🏃 Running Relevancy Agent...")
        run_relevancy_agent(db, lead.result_id)

        # 5. Check Results
        db.refresh(lead)
        print("\n✅ Verification Results:")
        print(f"   - Relevance Decision: {lead.relevance_status}")
        print(f"   - Score: {lead.relevance_score}")
        print(f"   - Business Type: {lead.business_type}")
        print(f"   - Primary Niche: {lead.primary_niche}")
        print(f"   - Reason: {lead.relevance_reason}")
        
        # Validation Logic
        if lead.relevance_status == "irrelevant" or lead.relevance_score < 50:
             print("\n✨ SUCCESS: Agent correctly identified Python.org is irrelevant to 'Leather Jacket Wholesalers'.")
        else:
             print("\n⚠️ NOTICE: Agent marked it relevant. Check reasoning above.")

    except Exception as e:
        print(f"\n❌ Verification Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️ WARNING: OPENAI_API_KEY not found. Agent might fail at Analyst step.")
    
    verify()
