from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Subreddit
from ..schemas import SubredditCreate, SubredditResponse, SubredditList
from ..services import RedditService

router = APIRouter(prefix="/api/subreddits", tags=["subreddits"])


@router.get("", response_model=SubredditList)
def list_subreddits(db: Session = Depends(get_db)):
    """List all tracked subreddits."""
    subreddits = db.query(Subreddit).order_by(Subreddit.name).all()
    return SubredditList(subreddits=subreddits, total=len(subreddits))


@router.get("/{subreddit_id}", response_model=SubredditResponse)
def get_subreddit(subreddit_id: int, db: Session = Depends(get_db)):
    """Get a specific subreddit by ID."""
    subreddit = db.query(Subreddit).filter(Subreddit.id == subreddit_id).first()
    if not subreddit:
        raise HTTPException(status_code=404, detail="Subreddit not found")
    return subreddit


@router.post("", response_model=SubredditResponse)
def create_subreddit(subreddit: SubredditCreate, db: Session = Depends(get_db)):
    """Add a new subreddit to track."""
    # Check if already exists
    existing = db.query(Subreddit).filter(Subreddit.name == subreddit.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subreddit already being tracked")

    # Verify subreddit exists on Reddit
    try:
        reddit_service = RedditService()
        if not reddit_service.verify_subreddit(subreddit.name):
            raise HTTPException(status_code=400, detail="Subreddit does not exist on Reddit")
    except Exception as e:
        # If Reddit API not configured, skip verification
        pass

    db_subreddit = Subreddit(
        name=subreddit.name,
        display_name=subreddit.display_name,
        stock_ticker=subreddit.stock_ticker,
    )
    db.add(db_subreddit)
    db.commit()
    db.refresh(db_subreddit)
    return db_subreddit


@router.delete("/{subreddit_id}")
def delete_subreddit(subreddit_id: int, db: Session = Depends(get_db)):
    """Remove a subreddit from tracking."""
    subreddit = db.query(Subreddit).filter(Subreddit.id == subreddit_id).first()
    if not subreddit:
        raise HTTPException(status_code=404, detail="Subreddit not found")

    db.delete(subreddit)
    db.commit()
    return {"message": "Subreddit deleted"}
