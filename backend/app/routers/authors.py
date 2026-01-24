from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from ..database import get_db
from ..models import Author, Post, Analysis
from ..schemas import AuthorResponse, AuthorDetail, AuthorList
from ..schemas.post import PostDetail
from ..services import ScorerService

router = APIRouter(prefix="/api/authors", tags=["authors"])


@router.get("", response_model=AuthorList)
def list_authors(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    min_posts: int = Query(1, ge=0),
    db: Session = Depends(get_db),
):
    """
    List authors ranked by average quality score.
    Only includes authors with at least min_posts analyzed posts.
    """
    query = (
        db.query(Author)
        .filter(Author.total_posts >= min_posts)
        .order_by(Author.average_score.desc())
    )

    total = query.count()
    authors = query.offset(offset).limit(limit).all()

    return AuthorList(authors=authors, total=total)


@router.get("/{username}", response_model=AuthorDetail)
def get_author(username: str, db: Session = Depends(get_db)):
    """Get author details including their posts."""
    author = (
        db.query(Author)
        .filter(Author.reddit_username == username)
        .first()
    )

    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    # Get posts with their analyses
    posts = (
        db.query(Post)
        .options(joinedload(Post.analysis), joinedload(Post.subreddit))
        .filter(Post.author_id == author.id)
        .order_by(Post.created_utc.desc())
        .all()
    )

    # Build response with posts
    author_dict = {
        "id": author.id,
        "reddit_username": author.reddit_username,
        "total_posts": author.total_posts,
        "average_score": author.average_score,
        "highest_score": author.highest_score,
        "created_at": author.created_at,
        "updated_at": author.updated_at,
        "posts": posts,
    }

    return author_dict


@router.get("/{username}/rank")
def get_author_rank(username: str, db: Session = Depends(get_db)):
    """Get an author's rank among all authors."""
    author = db.query(Author).filter(Author.reddit_username == username).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    scorer = ScorerService(db)
    rank = scorer.get_author_ranking(author.id)

    if rank is None:
        raise HTTPException(status_code=400, detail="Author has no analyzed posts")

    total_ranked = db.query(Author).filter(Author.total_posts > 0).count()

    return {
        "username": username,
        "rank": rank,
        "total_authors": total_ranked,
        "average_score": author.average_score,
    }
