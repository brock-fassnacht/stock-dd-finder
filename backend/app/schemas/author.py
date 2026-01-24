from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .post import PostResponse


class AuthorBase(BaseModel):
    reddit_username: str


class AuthorResponse(AuthorBase):
    id: int
    total_posts: int
    average_score: float
    highest_score: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuthorDetail(AuthorResponse):
    posts: List["PostResponse"] = []

    class Config:
        from_attributes = True


class AuthorList(BaseModel):
    authors: list[AuthorResponse]
    total: int


# Import at end to avoid circular imports
from .post import PostResponse
AuthorDetail.model_rebuild()
