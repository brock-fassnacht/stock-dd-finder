from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .database import engine, Base
from .routers import companies_router, filings_router, prices_router
from .config import get_settings
from .services.sync import sync_all_companies

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SEC Filing Timeline...")
    if engine:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    else:
        logger.warning("Database not configured - set DATABASE_URL in .env")

    # Run daily at 06:00 UTC
    scheduler.add_job(sync_all_companies, "cron", hour=6, minute=0)
    scheduler.start()
    logger.info("Scheduler started: daily sync at 06:00 UTC")

    yield

    scheduler.shutdown()
    logger.info("Shutting down...")


app = FastAPI(
    title="Stock DD Finder",
    description="SEC EDGAR filing timeline with AI summaries",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies_router)
app.include_router(filings_router)
app.include_router(prices_router)


@app.get("/")
async def root():
    return {
        "name": "Stock DD Finder",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "healthy",
        "database_configured": bool(settings.database_url),
        "groq_configured": bool(settings.groq_api_key),
    }
