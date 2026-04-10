import sys
import os
from pprint import pprint

# Ensure we're running inside Docker correctly
import dotenv
dotenv.load_dotenv("/app/.env")

from app.db.session import SessionLocal
from app.agents.email_outreach.email_draft_service import generate_draft_for_lead
from app.models.email_draft import EmailDraft

def test():
    db = SessionLocal()
    try:
        # First let's check what drafts currently exist for business_id 29
        print("\n--- EXISTING DRAFTS FOR BUSINESS 29 ---")
        existing_drafts = db.query(EmailDraft).filter(EmailDraft.business_id == 29).all()
        for draft in existing_drafts:
            print(f"ID: {draft.id}, Status: {draft.status}, Subject: {draft.subject}")
            
        print("\n--- TRIGGERING GENERATION FOR BUSINESS 29 ---")
        res = generate_draft_for_lead(business_id=29, user_id=1, sequence_position=1)
        print("GENERATE RESULT:")
        pprint(res)
        
    finally:
        db.close()

if __name__ == "__main__":
    test()
