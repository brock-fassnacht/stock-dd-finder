from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from .database import engine, Base
from .routers import subreddits_router, authors_router, posts_router, admin_router
from .config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Reddit Stock Research Analyzer...")
    if engine:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    else:
        logger.warning("Database not configured - set DATABASE_URL in .env")
    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="Reddit Stock Research Analyzer",
    description="Analyze and rank stock research quality from Reddit",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(subreddits_router)
app.include_router(authors_router)
app.include_router(posts_router)
app.include_router(admin_router)


@app.get("/")
async def root():
    return {
        "name": "Reddit Stock Research Analyzer",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "healthy",
        "database_configured": bool(settings.database_url),
        "reddit_configured": bool(settings.reddit_client_id),
        "anthropic_configured": bool(settings.anthropic_api_key),
    }
