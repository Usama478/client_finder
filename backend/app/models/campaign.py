from __future__ import annotations
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, func
from app.db.base import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    # User config
    search_intent = Column(Text, nullable=False)
    context_id = Column(Integer, nullable=True)
    target_count = Column(Integer, nullable=False)
    relevance_threshold = Column(Integer, nullable=False, default=60)
    credit_budget = Column(Integer, nullable=False)
    discovery_platform = Column(String, nullable=False, default="both")

    # Runtime tracking
    status = Column(String, nullable=False, default="pending")
    current_pass = Column(Integer, default=0)
    verified_count = Column(Integer, default=0)
    credits_used = Column(Integer, default=0)
    estimated_cost_low = Column(Integer, nullable=True)
    estimated_cost_high = Column(Integer, nullable=True)

    # Results summary
    total_discovered = Column(Integer, default=0)
    total_relevance_passed = Column(Integer, default=0)
    total_verification_passed = Column(Integer, default=0)

    # Log — JSONB stored as Text for simplicity
    activity_log = Column(Text, nullable=True)

    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
