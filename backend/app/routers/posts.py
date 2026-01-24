from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..models import Post, Subreddit, Author, Analysis
from ..schemas import PostDetail, PostList

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=PostList)
def list_posts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    subreddit: Optional[str] = Query(None, description="Filter by subreddit name"),
    author: Optional[str] = Query(None, description="Filter by author username"),
    min_score: Optional[float] = Query(None, description="Minimum quality score"),
    analyzed_only: bool = Query(False, description="Only return analyzed posts"),
    sort_by: str = Query("created_utc", description="Sort field: created_utc, quality_score, reddit_score"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db),
):
    """List posts with optional filters."""
    query = (
        db.query(Post)
        .options(
            joinedload(Post.subreddit),
            joinedload(Post.author),
            joinedload(Post.analysis),
        )
    )

    # Apply filters
    if subreddit:
        query = query.join(Subreddit).filter(Subreddit.name == subreddit)

    if author:
        query = query.join(Author).filter(Author.reddit_username == author)

    if analyzed_only or min_score is not None:
        query = query.join(Analysis)
        if min_score is not None:
            query = query.filter(Analysis.quality_score >= min_score)

    # Apply sorting
    if sort_by == "quality_score":
        if not analyzed_only and min_score is None:
            query = query.outerjoin(Analysis)
        order_col = Analysis.quality_score
    elif sort_by == "reddit_score":
        order_col = Post.score
    else:
        order_col = Post.created_utc

    if sort_order == "asc":
        query = query.order_by(order_col.asc())
    else:
        query = query.order_by(order_col.desc())

    # Get total before pagination
    total = query.count()

    # Apply pagination
    posts = query.offset(offset).limit(limit).all()

    return PostList(posts=posts, total=total)


@router.get("/{post_id}", response_model=PostDetail)
def get_post(post_id: int, db: Session = Depends(get_db)):
    """Get a specific post with its analysis."""
    post = (
        db.query(Post)
        .options(
            joinedload(Post.subreddit),
            joinedload(Post.author),
            joinedload(Post.analysis),
        )
        .filter(Post.id == post_id)
        .first()
    )

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return post


@router.get("/reddit/{reddit_id}", response_model=PostDetail)
def get_post_by_reddit_id(reddit_id: str, db: Session = Depends(get_db)):
    """Get a post by its Reddit ID."""
    post = (
        db.query(Post)
        .options(
            joinedload(Post.subreddit),
            joinedload(Post.author),
            joinedload(Post.analysis),
        )
        .filter(Post.reddit_id == reddit_id)
        .first()
    )

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return post
