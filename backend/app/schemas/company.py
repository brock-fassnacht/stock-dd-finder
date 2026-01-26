from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CompanyBase(BaseModel):
    ticker: str
    name: str
    cik: str


class CompanyCreate(BaseModel):
    ticker: str


class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
