from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class UserContext(Base):
    __tablename__ = "user_context"

    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)

    company_name = Column(Text, nullable=False)
    company_description = Column(Text, nullable=False)
    products_offered = Column(Text, nullable=False)
    target_markets = Column(Text, nullable=True)
    target_industries = Column(Text, nullable=True)
    relevance_rules = Column(Text, nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
