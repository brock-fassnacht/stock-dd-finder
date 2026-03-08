from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class BearVsBullArgument(Base):
    __tablename__ = "bear_vs_bull_arguments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    stance = Column(String, nullable=False, index=True)
    source_type = Column(String, nullable=False, index=True)
    source_name = Column(String, nullable=False)
    author_handle = Column(String, nullable=True)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    url = Column(String, nullable=True)
    as_of_date = Column(Date, nullable=False)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="bear_vs_bull_arguments")
