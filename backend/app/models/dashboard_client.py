from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from app.db.base import Base

class DashboardClient(Base):
    __tablename__ = "dashboard_clients"

    client_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    result_id = Column(Integer, ForeignKey("search_results.result_id"), nullable=False)

    notes = Column(Text, nullable=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
