from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime,
    Text, Boolean
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class ExporterProfile(Base):
    __tablename__ = "exporter_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    is_default = Column(Boolean, default=False)
    profile_name = Column(String(100), nullable=False)

    company_name = Column(String(200), nullable=False)
    company_location = Column(String(200), nullable=True)
    year_established = Column(Integer, nullable=True)
    website = Column(String(500), nullable=True)
    contact_person_name = Column(String(200), nullable=True)
    contact_email = Column(String(200), nullable=True)

    product_categories = Column(JSONB, default=list)
    key_products = Column(JSONB, default=list)
    specializations = Column(JSONB, default=list)
    preferred_categories_for_outreach = Column(JSONB, default=list)

    moq = Column(Integer, nullable=True)
    monthly_capacity = Column(String(100), nullable=True)
    sampling_available = Column(Boolean, default=True)
    sampling_turnaround_days = Column(Integer, nullable=True)
    bulk_lead_time_days = Column(Integer, nullable=True)
    sample_policy = Column(Text, nullable=True)
    minimum_order_flexibility_note = Column(Text, nullable=True)

    certifications = Column(JSONB, default=list)

    export_markets = Column(JSONB, default=list)
    client_types = Column(JSONB, default=list)
    target_buyer_types = Column(JSONB, default=list)

    value_proposition = Column(Text, nullable=True)
    production_strengths = Column(JSONB, default=list)

    services = Column(JSONB, default=list)
    shipping_terms = Column(JSONB, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(), onupdate=func.now())
