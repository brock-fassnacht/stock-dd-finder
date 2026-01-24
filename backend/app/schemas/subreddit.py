from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SubredditBase(BaseModel):
    name: str
    display_name: str
    stock_ticker: Optional[str] = None


class SubredditCreate(SubredditBase):
    pass


class SubredditResponse(SubredditBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SubredditList(BaseModel):
    subreddits: list[SubredditResponse]
    total: int
