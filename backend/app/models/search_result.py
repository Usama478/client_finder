from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime,
    Text, Float, JSON, Boolean
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class SearchResult(Base):
    __tablename__ = "search_results"

    result_id = Column(Integer, primary_key=True, index=True)
    place_id = Column(String, index=True, nullable=True)
    source = Column(String, nullable=False, server_default="maps")

    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    search_id = Column(Integer, ForeignKey("search_sessions.search_id"), nullable=False, index=True)

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
    relevance_decision = Column(String, nullable=True)
    relevance_score = Column(Float, nullable=True)
    relevance_reason = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    match_reasons = Column(JSON, nullable=True)
    mismatch_reasons = Column(JSON, nullable=True)
    signals_used = Column(JSON, nullable=True)
    
    # New Analyst Fields
    business_type = Column(String, nullable=True)
    primary_niche = Column(String, nullable=True)

    # Relevancy structured artifact blob (platform, catalog_mode, fetch_method, timeout_hit, etc.)
    relevancy_artifacts = Column(JSON, nullable=True)

    # Verification agent — core decision
    verification_status = Column(String, default="pending")
    verification_result = Column(String, nullable=True)
    verification_reason = Column(Text, nullable=True)
    verification_score = Column(Integer, nullable=True)
    verification_confidence = Column(Float, nullable=True)
    risk_flags = Column(JSONB, default=list)
    manual_review = Column(Boolean, default=False)

    # Verification agent — structured artifact blob
    verification_artifacts = Column(JSONB, nullable=True)

    # Enrichment fields
    serp_enrichment = Column(JSONB, nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    verified_product_catalog = Column(JSONB, nullable=True)

    # Hunter.io email lookup
    hunter_emails = Column(JSONB, nullable=True)
    primary_contact_email = Column(String(255), nullable=True)

    # Verification agent — identity
    company_name_confirmed = Column(String(255), nullable=True)
    domain_match_confidence = Column(Float, nullable=True)
    country_confirmed = Column(String(100), nullable=True)

    # Verification agent — contact
    contactability_score = Column(Integer, default=0)
    email_type = Column(String(255)), nullable=True)
    all_emails_found = Column(JSONB, default=list)
    all_phones_found = Column(JSONB, default=list)
    whatsapp_number = Column(String(500)), nullable=True)
    linkedin_company_url = Column(String(500), nullable=True)
    social_links = Column(JSONB, default=dict)
    contact_form_present = Column(Boolean, default=False)

    # Verification agent — collection
    wholesale_page_found = Column(Boolean, default=False)
    wholesale_page_url = Column(String(500), nullable=True)

    # Verification agent — legitimacy
    has_about_page = Column(Boolean, default=False)
    has_contact_page = Column(Boolean, default=False)
    has_policy_pages = Column(Boolean, default=False)
    legitimacy_score = Column(Integer, default=0)
    domain_age_years = Column(Integer, nullable=True)

    # Verification agent — size
    employee_range = Column(String(20), nullable=True)
    revenue_band = Column(String(20), nullable=True)

    # Verification agent — email context for Email Agent
    email_context = Column(JSONB, nullable=True)

    # Email agent (Agent 3)
    email_status = Column(String, default="pending")     # <--- NEW
    email_found = Column(String, nullable=True)          # <--- NEW
    email_score = Column(Integer, nullable=True)         # <--- NEW
    outreach_status = Column(String, default="pending") # pending, drafted, sent, skipped
    email_subject = Column(Text, nullable=True)
    email_body = Column(Text, nullable=True)

    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True, index=True)
    campaign_status = Column(String, nullable=True)
    campaign_pass = Column(Integer, nullable=True, default=1)

    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


