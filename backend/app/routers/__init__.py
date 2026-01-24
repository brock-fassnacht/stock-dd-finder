from .subreddits import router as subreddits_router
from .authors import router as authors_router
from .posts import router as posts_router
from .admin import router as admin_router

__all__ = ["subreddits_router", "authors_router", "posts_router", "admin_router"]
