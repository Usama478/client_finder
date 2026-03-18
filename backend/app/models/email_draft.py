from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime,
    Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class EmailDraft(Base):
    __tablename__ = "email_drafts"

    __table_args__ = (
        UniqueConstraint(
            "business_id", "sequence_position", "exporter_profile_id",
            name="uq_email_drafts_business_sequence_profile"
        ),
    )

    id = Column(Integer, primary_key=True)
    business_id = Column(Integer,
                         ForeignKey("search_results.result_id"),
                         nullable=False)
    exporter_profile_id = Column(Integer,
                                 ForeignKey("exporter_profiles.id"),
                                 nullable=False)
    sequence_position = Column(Integer, default=1)

    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=True)
    strategy = Column(JSONB, nullable=True)

    status = Column(String(50), default="pending_review")
    # pending_review | approved | sent | bounced | failed | replied

    sendgrid_message_id = Column(String(200), nullable=True)
    sendgrid_message_id_normalized = Column(String(200), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    bounced_at = Column(DateTime(timezone=True), nullable=True)
    bounce_reason = Column(String(500), nullable=True)

    generation_model = Column(String(100), nullable=True)
    generation_error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(), onupdate=func.now())
