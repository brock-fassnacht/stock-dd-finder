from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..models import Author, Post, Analysis


class ScorerService:
    """Service for calculating and updating author scores."""

    def __init__(self, db: Session):
        self.db = db

    def update_author_scores(self, author_id: int) -> Optional[Author]:
        """
        Recalculate and update an author's aggregate scores based on their analyzed posts.
        """
        author = self.db.query(Author).filter(Author.id == author_id).first()
        if not author:
            return None

        # Get all analyzed posts for this author
        analyzed_posts = (
            self.db.query(Analysis)
            .join(Post)
            .filter(Post.author_id == author_id)
            .filter(Analysis.quality_score.isnot(None))
            .all()
        )

        if not analyzed_posts:
            return author

        # Calculate aggregate scores
        scores = [a.quality_score for a in analyzed_posts]
        author.total_posts = len(analyzed_posts)
        author.average_score = sum(scores) / len(scores)
        author.highest_score = max(scores)

        self.db.commit()
        self.db.refresh(author)
        return author

    def update_all_author_scores(self) -> int:
        """
        Update scores for all authors. Returns the number of authors updated.
        """
        authors = self.db.query(Author).all()
        updated = 0

        for author in authors:
            result = self.update_author_scores(author.id)
            if result:
                updated += 1

        return updated

    def get_top_authors(self, limit: int = 20) -> List[Author]:
        """
        Get the top authors ranked by average quality score.
        Only includes authors with at least one analyzed post.
        """
        return (
            self.db.query(Author)
            .filter(Author.total_posts > 0)
            .order_by(Author.average_score.desc())
            .limit(limit)
            .all()
        )

    def get_author_ranking(self, author_id: int) -> Optional[int]:
        """
        Get an author's rank among all authors.
        Returns None if author not found or has no analyzed posts.
        """
        author = self.db.query(Author).filter(Author.id == author_id).first()
        if not author or author.total_posts == 0:
            return None

        # Count authors with higher average scores
        higher_ranked = (
            self.db.query(func.count(Author.id))
            .filter(Author.total_posts > 0)
            .filter(Author.average_score > author.average_score)
            .scalar()
        )

        return higher_ranked + 1
