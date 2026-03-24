from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class BearVsBullPost(Base):
    __tablename__ = "bear_vs_bull_posts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stance = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    source_type = Column(String, nullable=True, index=True)
    source_name = Column(String, nullable=True)
    source_url = Column(Text, nullable=True)
    source_published_at = Column(Date, nullable=True)
    external_id = Column(String(120), nullable=True, index=True)
    created_via = Column(String(20), nullable=False, default="member", server_default="member", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="bear_vs_bull_posts")
    user = relationship("User", back_populates="bear_vs_bull_posts")
