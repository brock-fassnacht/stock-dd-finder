import logging
from typing import List
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import Subreddit, Author, Post, Analysis
from ..services import RedditService, AnalyzerService, ScorerService

logger = logging.getLogger(__name__)


def fetch_and_analyze_posts(
    subreddit_names: List[str],
    limit: int = 50,
    analyze: bool = True,
    time_filter: str = "week",
):
    """
    Fetch posts from specified subreddits and optionally analyze them.
    This runs as a background task.
    """
    db = SessionLocal()
    if db is None:
        logger.error("Database not configured")
        return

    try:
        reddit = RedditService()
        analyzer = AnalyzerService() if analyze else None
        scorer = ScorerService(db)

        for subreddit_name in subreddit_names:
            logger.info(f"Fetching posts from r/{subreddit_name}")

            # Get or create subreddit record
            subreddit = db.query(Subreddit).filter(Subreddit.name == subreddit_name).first()
            if not subreddit:
                logger.warning(f"Subreddit {subreddit_name} not in database, skipping")
                continue

            # Fetch posts from Reddit
            try:
                posts = reddit.fetch_posts(
                    subreddit_name=subreddit_name,
                    limit=limit,
                    time_filter=time_filter,
                    sort="top",
                )
            except Exception as e:
                logger.error(f"Failed to fetch from r/{subreddit_name}: {e}")
                continue

            logger.info(f"Found {len(posts)} posts from r/{subreddit_name}")

            for reddit_post in posts:
                # Skip if already exists
                existing = db.query(Post).filter(Post.reddit_id == reddit_post.reddit_id).first()
                if existing:
                    continue

                # Get or create author
                author = db.query(Author).filter(
                    Author.reddit_username == reddit_post.author_name
                ).first()

                if not author:
                    author = Author(reddit_username=reddit_post.author_name)
                    db.add(author)
                    db.flush()

                # Create post
                post = Post(
                    reddit_id=reddit_post.reddit_id,
                    subreddit_id=subreddit.id,
                    author_id=author.id,
                    title=reddit_post.title,
                    body=reddit_post.body,
                    url=reddit_post.url,
                    score=reddit_post.score,
                    created_utc=reddit_post.created_utc,
                )
                db.add(post)
                db.flush()

                logger.info(f"Added post: {reddit_post.title[:50]}...")

                # Analyze if enabled
                if analyze and analyzer:
                    try:
                        summary, scores = analyzer.analyze_post(
                            reddit_post.title,
                            reddit_post.body,
                        )

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
                        logger.info(f"Analyzed post with score: {scores.overall_score}")

                    except Exception as e:
                        logger.error(f"Failed to analyze post {post.id}: {e}")

                db.commit()

        # Update all author scores at the end
        if analyze:
            logger.info("Updating author scores...")
            scorer.update_all_author_scores()

        logger.info("Fetch complete")

    except Exception as e:
        logger.error(f"Fetch task failed: {e}")
        db.rollback()
    finally:
        db.close()


def analyze_unanalyzed_posts(limit: int = 50):
    """Analyze posts that haven't been analyzed yet."""
    db = SessionLocal()
    if db is None:
        logger.error("Database not configured")
        return

    try:
        analyzer = AnalyzerService()
        scorer = ScorerService(db)

        # Get unanalyzed posts
        unanalyzed = (
            db.query(Post)
            .outerjoin(Analysis)
            .filter(Analysis.id.is_(None))
            .limit(limit)
            .all()
        )

        logger.info(f"Found {len(unanalyzed)} unanalyzed posts")

        authors_to_update = set()

        for post in unanalyzed:
            try:
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

                authors_to_update.add(post.author_id)
                logger.info(f"Analyzed post {post.id} with score: {scores.overall_score}")

            except Exception as e:
                logger.error(f"Failed to analyze post {post.id}: {e}")
                db.rollback()

        # Update author scores
        for author_id in authors_to_update:
            scorer.update_author_scores(author_id)

        logger.info("Analysis complete")

    except Exception as e:
        logger.error(f"Analysis task failed: {e}")
    finally:
        db.close()
