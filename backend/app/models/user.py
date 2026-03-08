from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")
    bear_vs_bull_posts = relationship("BearVsBullPost", back_populates="user", cascade="all, delete-orphan")
    bear_vs_bull_votes = relationship("BearVsBullVote", back_populates="user", cascade="all, delete-orphan")
