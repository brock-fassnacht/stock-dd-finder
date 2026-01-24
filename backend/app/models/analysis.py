from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), unique=True, nullable=False)
    summary = Column(Text, nullable=True)  # Claude-generated summary
    quality_score = Column(Float, nullable=True)  # Overall score 1-100
    methodology_score = Column(Float, nullable=True)  # 1-10
    sources_score = Column(Float, nullable=True)  # 1-10
    reasoning_score = Column(Float, nullable=True)  # 1-10
    objectivity_score = Column(Float, nullable=True)  # 1-10
    feedback = Column(Text, nullable=True)  # Claude's explanation
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    post = relationship("Post", back_populates="analysis")
