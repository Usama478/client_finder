from sqlalchemy import Column, Integer, String, Text
from app.db.base import Base
from sqlalchemy.orm import relationship

class SearchContext(Base):
    __tablename__ = "search_contexts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    prompt_text = Column(Text, nullable=False)

    sessions = relationship("SearchSession", back_populates="context")
