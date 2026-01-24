from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..models import Subreddit, Author, Post, Analysis
from ..services import RedditService, AnalyzerService, ScorerService
from ..tasks.fetch_posts import fetch_and_analyze_posts

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/fetch")
async def trigger_fetch(
    background_tasks: BackgroundTasks,
    subreddit: Optional[str] = Query(None, description="Specific subreddit to fetch"),
    limit: int = Query(50, ge=1, le=100),
    analyze: bool = Query(True, description="Run analysis after fetching"),
    db: Session = Depends(get_db),
):
    """
    Trigger a manual fetch of posts.
    If no subreddit specified, fetches from all tracked subreddits.
    """
    if subreddit:
        sub = db.query(Subreddit).filter(Subreddit.name == subreddit).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subreddit not tracked")
        subreddit_names = [subreddit]
    else:
        subreddits = db.query(Subreddit).all()
        if not subreddits:
            raise HTTPException(status_code=400, detail="No subreddits being tracked")
        subreddit_names = [s.name for s in subreddits]

    # Run fetch in background
    background_tasks.add_task(
        fetch_and_analyze_posts,
        subreddit_names=subreddit_names,
        limit=limit,
        analyze=analyze,
    )

    return {
        "message": "Fetch started",
        "subreddits": subreddit_names,
        "limit": limit,
        "analyze": analyze,
    }


@router.post("/analyze/{post_id}")
def analyze_post(post_id: int, db: Session = Depends(get_db)):
    """Trigger analysis for a specific post."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check if already analyzed
    existing = db.query(Analysis).filter(Analysis.post_id == post_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Post already analyzed")

    try:
        analyzer = AnalyzerService()
        summary, scores = analyzer.analyze_post(post.title, post.body or "")

        analysis = Analysis(
            post_id=post.id,
            summary=summary.summary,
            quality_score=scores.overall_score,
            methodology_score=scores.methodology_score,
            sources_score=scores.sources_score,
            reasoning_score=scores.reasoning_score,
            objectivity_score=scores.objectivity_score,
            feedback=scores.feedback,
        )
        db.add(analysis)
        db.commit()

        # Update author scores
        scorer = ScorerService(db)
        scorer.update_author_scores(post.author_id)

        return {
            "message": "Analysis complete",
            "post_id": post_id,
            "quality_score": scores.overall_score,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/update-scores")
def update_all_scores(db: Session = Depends(get_db)):
    """Recalculate scores for all authors."""
    scorer = ScorerService(db)
    updated = scorer.update_all_author_scores()
    return {"message": f"Updated scores for {updated} authors"}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics."""
    total_subreddits = db.query(Subreddit).count()
    total_authors = db.query(Author).count()
    total_posts = db.query(Post).count()
    total_analyzed = db.query(Analysis).count()

    # Top authors
    top_authors = (
        db.query(Author)
        .filter(Author.total_posts > 0)
        .order_by(Author.average_score.desc())
        .limit(5)
        .all()
    )

    return {
        "subreddits": total_subreddits,
        "authors": total_authors,
        "posts": total_posts,
        "analyzed": total_analyzed,
        "analysis_rate": round(total_analyzed / total_posts * 100, 1) if total_posts > 0 else 0,
        "top_authors": [
            {
                "username": a.reddit_username,
                "average_score": round(a.average_score, 1),
                "total_posts": a.total_posts,
            }
            for a in top_authors
        ],
    }
