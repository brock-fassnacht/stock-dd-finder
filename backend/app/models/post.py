from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    reddit_id = Column(String, unique=True, nullable=False, index=True)
    subreddit_id = Column(Integer, ForeignKey("subreddits.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("authors.id"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    url = Column(String, nullable=False)
    score = Column(Integer, default=0)  # Reddit upvotes
    created_utc = Column(DateTime(timezone=True), nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    subreddit = relationship("Subreddit", back_populates="posts")
    author = relationship("Author", back_populates="posts")
    analysis = relationship("Analysis", back_populates="post", uselist=False)
