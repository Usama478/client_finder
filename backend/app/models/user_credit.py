from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base

class UserCredit(Base):
    __tablename__ = "user_credits"
    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    credits_remaining = Column(Integer, default=200, nullable=False)
    credits_used_total = Column(Integer, default=0, nullable=False)
    allocated_total = Column(Integer, default=200, nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
