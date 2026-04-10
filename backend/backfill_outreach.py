import sys
import os

# Ensure we're running inside Docker correctly
import dotenv
dotenv.load_dotenv("/app/.env")

from app.db.session import SessionLocal
from app.models.email_draft import EmailDraft
from app.models.search_result import SearchResult

def backfill():
    db = SessionLocal()
    try:
        # Fetch all drafts that are sent, opened, replied, or bounced
        drafts = db.query(EmailDraft).filter(EmailDraft.status.in_(["sent", "opened", "replied", "bounced"])).all()
        
        updates = 0
        for draft in drafts:
            lead = db.query(SearchResult).filter(SearchResult.result_id == draft.business_id).first()
            if lead:
                # Give precedence to highest engagement (replied > bounced > opened > sent)
                current = lead.outreach_status or "pending"
                weights = {"pending": 0, "sent": 1, "opened": 2, "bounced": 3, "replied": 4}
                
                draft_weight = weights.get(draft.status, 0)
                current_weight = weights.get(current, 0)
                
                if draft_weight > current_weight:
                    lead.outreach_status = draft.status
                    updates += 1
                    
        db.commit()
        print(f"Successfully backfilled outreach_status for {updates} leads.")
    finally:
        db.close()

if __name__ == "__main__":
    backfill()
