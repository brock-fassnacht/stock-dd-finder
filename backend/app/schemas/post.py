from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AnalysisInPost(BaseModel):
    id: int
    summary: Optional[str] = None
    quality_score: Optional[float] = None
    methodology_score: Optional[float] = None
    sources_score: Optional[float] = None
    reasoning_score: Optional[float] = None
    objectivity_score: Optional[float] = None
    feedback: Optional[str] = None
    analyzed_at: datetime

    class Config:
        from_attributes = True


class SubredditInPost(BaseModel):
    id: int
    name: str
    display_name: str
    stock_ticker: Optional[str] = None

    class Config:
        from_attributes = True


class AuthorInPost(BaseModel):
    id: int
    reddit_username: str
    average_score: float

    class Config:
        from_attributes = True


class PostBase(BaseModel):
    reddit_id: str
    title: str
    body: Optional[str] = None
    url: str
    score: int
    created_utc: datetime


class PostResponse(PostBase):
    id: int
    subreddit_id: int
    author_id: int
    fetched_at: datetime

    class Config:
        from_attributes = True


class PostDetail(PostResponse):
    subreddit: SubredditInPost
    author: AuthorInPost
    analysis: Optional[AnalysisInPost] = None

    class Config:
        from_attributes = True


class PostList(BaseModel):
    posts: list[PostDetail]
    total: int
