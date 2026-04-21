from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base

class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    action_type = Column(String, nullable=False)
    credits_delta = Column(Integer, nullable=False)
    credits_after = Column(Integer, nullable=False)
    reference_id = Column(String, nullable=True)
    reference_type = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    cost_estimate_usd = Column(Float, nullable=True)
