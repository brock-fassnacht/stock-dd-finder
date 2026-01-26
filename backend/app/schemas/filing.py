from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List


class FilingBase(BaseModel):
    accession_number: str
    form_type: str
    filed_date: date
    document_url: str


class FilingResponse(FilingBase):
    id: int
    company_id: int
    headline: Optional[str] = None
    form_type_description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FilingDetail(FilingResponse):
    summary: Optional[str] = None
    company_ticker: str
    company_name: str


class TimelineEvent(BaseModel):
    id: int
    ticker: str
    company_name: str
    form_type: str
    form_type_description: str
    filed_date: date
    headline: Optional[str] = None
    document_url: str


class TimelineResponse(BaseModel):
    events: List[TimelineEvent]
    total: int
