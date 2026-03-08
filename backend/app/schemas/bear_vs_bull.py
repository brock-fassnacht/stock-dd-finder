from datetime import date

from pydantic import BaseModel, Field, field_validator


class BearVsBullArgumentResponse(BaseModel):
    id: int
    entry_type: str
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
    vote_score: int
    upvotes: int
    downvotes: int
    has_voted: bool
    is_user_generated: bool


class BearVsBullCreateRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    stance: str
    title: str = Field(min_length=5, max_length=120)
    summary: str = Field(min_length=20, max_length=1700)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("stance")
    @classmethod
    def normalize_stance(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"bull", "bear"}:
            raise ValueError("Stance must be bull or bear")
        return normalized


class BearVsBullVoteRequest(BaseModel):
    direction: str

    @field_validator("direction")
    @classmethod
    def normalize_direction(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"up", "down"}:
            raise ValueError("Vote must be up or down")
        return normalized


class BearVsBullResponse(BaseModel):
    ticker: str | None
    bull_arguments: list[BearVsBullArgumentResponse]
    bear_arguments: list[BearVsBullArgumentResponse]
