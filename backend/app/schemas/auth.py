from datetime import datetime
import re

from pydantic import BaseModel, Field, field_validator


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str | None
    member_label: str
    account_type: str
    monthly_post_limit_per_stance: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuthSessionResponse(BaseModel):
    token: str
    user: UserResponse


class AgentAccountCreateRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)
    monthly_post_limit_per_stance: int = Field(default=10, ge=1, le=50)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Enter a valid email address")
        return normalized

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AgentAccountProvisionResponse(BaseModel):
    email: str
    password: str
    token: str
    user: UserResponse


class AgentApiKeyCreateRequest(BaseModel):
    label: str = Field(min_length=2, max_length=80)

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Label must be at least 2 characters")
        return normalized


class AgentApiKeyResponse(BaseModel):
    id: int
    label: str
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class AgentApiKeyCreateResponse(BaseModel):
    api_key: str
    key: AgentApiKeyResponse


class AgentApiKeyListResponse(BaseModel):
    agent: UserResponse
    keys: list[AgentApiKeyResponse]
