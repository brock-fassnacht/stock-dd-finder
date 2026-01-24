from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AnalysisBase(BaseModel):
    summary: Optional[str] = None
    quality_score: Optional[float] = None
    methodology_score: Optional[float] = None
    sources_score: Optional[float] = None
    reasoning_score: Optional[float] = None
    objectivity_score: Optional[float] = None
    feedback: Optional[str] = None


class AnalysisCreate(AnalysisBase):
    post_id: int


class AnalysisResponse(AnalysisBase):
    id: int
    post_id: int
    analyzed_at: datetime

    class Config:
        from_attributes = True
