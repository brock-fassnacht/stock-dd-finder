from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    cik = Column(String, unique=True, nullable=False)  # SEC Central Index Key
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    filings = relationship("Filing", back_populates="company")
    press_releases = relationship("PressRelease", back_populates="company")
