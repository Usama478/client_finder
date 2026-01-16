from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class AgentRun(Base):
    __tablename__ = "agent_runs"

    run_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    search_id = Column(Integer, ForeignKey("search_sessions.search_id"), nullable=False)

    agent_type = Column(String, nullable=False)  # relevance / verification
    status = Column(String, default="running")

    last_processed_result_id = Column(Integer, nullable=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
