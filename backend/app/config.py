from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Groq (free tier)
    groq_api_key: str = ""

    # Database (SQLite for local, PostgreSQL for prod)
    database_url: str = "sqlite:///./stock_dd.db"

    # App settings
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
