from datetime import date
from pydantic import BaseModel


class BearVsBullArgumentResponse(BaseModel):
    id: int
    ticker: str
    company_name: str
    stance: str
    source_type: str
    source_name: str
    author_handle: str | None
    title: str
    summary: str
    url: str | None
    as_of_date: date
    confidence_score: float | None


class BearVsBullResponse(BaseModel):
    ticker: str | None
    bull_arguments: list[BearVsBullArgumentResponse]
    bear_arguments: list[BearVsBullArgumentResponse]
