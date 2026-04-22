from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.db.base import Base
from sqlalchemy.orm import relationship

class SearchContext(Base):
    __tablename__ = "search_contexts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    prompt_text = Column(Text, nullable=False)

    sessions = relationship("SearchSession", back_populates="context")
