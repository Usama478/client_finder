from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime,
    Text, Float, JSON, Boolean
)
from sqlalchemy.sql import func
from app.db.base import Base

class SearchResult(Base):
    __tablename__ = "search_results"

    result_id = Column(Integer, primary_key=True, index=True)
    place_id = Column(String, unique=True, index=True, nullable=False)

    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    search_id = Column(Integer, ForeignKey("search_sessions.search_id"), nullable=False)

    raw_data = Column(JSON, nullable=False)

    business_name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    website = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    is_saved_client = Column(Boolean, default=False)

    # Scraping memory
    scraping_status = Column(String, default="pending")
    scraped_text_content = Column(Text, nullable=True)

    # Relevance agent
    relevance_status = Column(String, default="pending")
    relevance_score = Column(Float, nullable=True)
    relevance_reason = Column(Text, nullable=True)
    
    # New Analyst Fields
    business_type = Column(String, nullable=True)
    primary_niche = Column(String, nullable=True)

    # Verification agent
    verification_status = Column(String, default="pending")
    verification_result = Column(String, nullable=True)
    verification_reason = Column(Text, nullable=True)
    verification_score = Column(Integer, nullable=True)  # <--- NEW
    risk_flags = Column(JSON, default=[])         # <--- NEW
    manual_review = Column(Boolean, default=False) # <--- NEWcd

    # Email agent (Agent 3)
    email_status = Column(String, default="pending")     # <--- NEW
    email_found = Column(String, nullable=True)          # <--- NEW
    email_score = Column(Integer, nullable=True)         # <--- NEW
    outreach_status = Column(String, default="pending") # pending, drafted, sent, skipped
    email_subject = Column(Text, nullable=True)
    email_body = Column(Text, nullable=True)


    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


