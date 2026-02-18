from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Groq (free tier)
    groq_api_key: str = ""

    # Database (SQLite for local, PostgreSQL for prod)
    database_url: str = "sqlite:///./stock_dd.db"

    # Admin
    admin_key: str = ""

    # Groq model (override via GROQ_MODEL env var)
    groq_model: str = "llama-3.1-8b-instant"

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,https://*.vercel.app"

    # App settings
    debug: bool = False

    class Config:
        env_file = str(BACKEND_DIR / ".env")
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
