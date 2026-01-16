from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.db.base import Base

class SearchSession(Base):
    __tablename__ = "search_sessions"

    search_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    search_query = Column(String, nullable=False)
    search_location = Column(String, nullable=True)
    search_filters = Column(JSON, nullable=True)

    google_api_request_hash = Column(String, index=True)
    next_page_token = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
