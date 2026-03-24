from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String(80), nullable=True)
    account_type = Column(String(20), nullable=False, default="member", server_default=text("'member'"))
    monthly_post_limit_per_stance = Column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")
    agent_api_keys = relationship("AgentApiKey", back_populates="user", cascade="all, delete-orphan")
    bear_vs_bull_posts = relationship("BearVsBullPost", back_populates="user", cascade="all, delete-orphan")
    bear_vs_bull_votes = relationship("BearVsBullVote", back_populates="user", cascade="all, delete-orphan")
