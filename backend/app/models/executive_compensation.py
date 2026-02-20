from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class ExecutiveCompensation(Base):
    __tablename__ = "executive_compensation"

    id = Column(Integer, primary_key=True, index=True)
    filing_id = Column(Integer, ForeignKey("filings.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    executive_name = Column(String, nullable=False)
    position = Column(String, nullable=True)
    total_compensation = Column(Float, nullable=True)
    salary = Column(Float, nullable=True)
    bonus = Column(Float, nullable=True)
    stock_awards = Column(Float, nullable=True)
    option_awards = Column(Float, nullable=True)
    other_compensation = Column(Float, nullable=True)

    fiscal_year = Column(Integer, nullable=True)
    filed_date = Column(Date, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    filing = relationship("Filing")
    company = relationship("Company")
