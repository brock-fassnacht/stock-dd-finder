from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class PressRelease(Base):
    __tablename__ = "press_releases"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    finnhub_id = Column(BigInteger, unique=True, nullable=False, index=True)
    headline = Column(String, nullable=False)
    source = Column(String, nullable=True)
    url = Column(String, nullable=False)
    published_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="press_releases")
