from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from ..database import Base


class InterestLog(Base):
    __tablename__ = "interest_log"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    searched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
