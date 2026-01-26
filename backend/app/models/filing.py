from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Filing(Base):
    __tablename__ = "filings"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    accession_number = Column(String, unique=True, nullable=False, index=True)
    form_type = Column(String, nullable=False, index=True)  # 10-K, 10-Q, 8-K, etc.
    filed_date = Column(Date, nullable=False, index=True)
    document_url = Column(String, nullable=False)

    # AI-generated content
    headline = Column(String, nullable=True)  # 1-3 sentence summary
    summary = Column(Text, nullable=True)  # Longer summary if needed

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="filings")
