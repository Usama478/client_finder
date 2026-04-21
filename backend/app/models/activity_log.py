from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.base import Base

class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    action_type = Column(String, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    session_id = Column(Integer, nullable=True)
    business_id = Column(Integer, nullable=True)
    credits_consumed = Column(Integer, default=0)
    cost_estimate_usd = Column(Float, nullable=True)
