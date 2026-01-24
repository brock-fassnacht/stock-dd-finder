from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Subreddit(Base):
    __tablename__ = "subreddits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)  # e.g., "ASTSpaceMobile"
    display_name = Column(String, nullable=False)  # e.g., "AST SpaceMobile"
    stock_ticker = Column(String, nullable=True)  # e.g., "ASTS"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    posts = relationship("Post", back_populates="subreddit")
