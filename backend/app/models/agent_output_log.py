from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.db.base import Base

class AgentOutputLog(Base):
    __tablename__ = "agent_output_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    agent_type = Column(String, nullable=False)

    result_id = Column(Integer, ForeignKey("search_results.result_id"), nullable=False)

    input_snapshot = Column(JSON, nullable=False)
    output_snapshot = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
