from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class BearVsBullVote(Base):
    __tablename__ = "bear_vs_bull_votes"
    __table_args__ = (
        UniqueConstraint("target_type", "target_id", "user_id", name="uq_bvb_vote_user"),
        UniqueConstraint("target_type", "target_id", "voter_ip_hash", name="uq_bvb_vote_ip"),
    )

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String, nullable=False, index=True)
    target_id = Column(Integer, nullable=False, index=True)
    direction = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    voter_ip_hash = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bear_vs_bull_votes")
