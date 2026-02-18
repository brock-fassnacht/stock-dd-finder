import re
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
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

# Build list of exact origins and wildcard patterns from ALLOWED_ORIGINS
_cors_exact: list[str] = []
_cors_patterns: list[re.Pattern[str]] = []
for origin in settings.allowed_origins.split(","):
    origin = origin.strip()
    if "*" in origin:
        # Convert wildcard pattern like https://*.vercel.app to regex
        pattern = re.escape(origin).replace(r"\*", r"[a-zA-Z0-9\.\-]+")
        _cors_patterns.append(re.compile(f"^{pattern}$"))
    else:
        _cors_exact.append(origin)


class WildcardCORSMiddleware:
    """Wraps CORSMiddleware but dynamically matches wildcard origin patterns."""

    def __init__(self, app: ASGIApp):
        # Base middleware allows exact origins
        self.app = app
        self.base = CORSMiddleware(
            app,
            allow_origins=_cors_exact,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket") or not _cors_patterns:
            await self.base(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode()

        if origin and any(p.match(origin) for p in _cors_patterns):
            # Origin matches a wildcard — create a middleware that allows it
            middleware = CORSMiddleware(
                self.app,
                allow_origins=[origin],
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )
            await middleware(scope, receive, send)
        else:
            await self.base(scope, receive, send)


app.add_middleware(WildcardCORSMiddleware)

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
