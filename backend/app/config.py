from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Reddit API
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "stock-research-analyzer/1.0"

    # Anthropic
    anthropic_api_key: str = ""

    # Database
    database_url: str = ""

    # App settings
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
