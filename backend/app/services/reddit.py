import praw
from datetime import datetime, timezone
from typing import List, Optional
from dataclasses import dataclass
from ..config import get_settings


@dataclass
class RedditPost:
    reddit_id: str
    subreddit_name: str
    author_name: str
    title: str
    body: str
    url: str
    score: int
    created_utc: datetime


class RedditService:
    def __init__(self):
        settings = get_settings()
        self.reddit = praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent,
        )

    def fetch_posts(
        self,
        subreddit_name: str,
        limit: int = 100,
        time_filter: str = "week",
        sort: str = "top"
    ) -> List[RedditPost]:
        """
        Fetch posts from a subreddit.

        Args:
            subreddit_name: Name of the subreddit (without r/)
            limit: Maximum number of posts to fetch
            time_filter: Time filter for top posts (hour, day, week, month, year, all)
            sort: Sort method (hot, new, top, rising)
        """
        subreddit = self.reddit.subreddit(subreddit_name)
        posts = []

        if sort == "top":
            submissions = subreddit.top(time_filter=time_filter, limit=limit)
        elif sort == "hot":
            submissions = subreddit.hot(limit=limit)
        elif sort == "new":
            submissions = subreddit.new(limit=limit)
        elif sort == "rising":
            submissions = subreddit.rising(limit=limit)
        else:
            submissions = subreddit.hot(limit=limit)

        for submission in submissions:
            # Skip deleted authors
            if submission.author is None:
                continue

            # Skip posts with very short content (likely not DD)
            body = submission.selftext or ""
            if len(body) < 100:
                continue

            posts.append(RedditPost(
                reddit_id=submission.id,
                subreddit_name=subreddit_name,
                author_name=str(submission.author),
                title=submission.title,
                body=body,
                url=f"https://reddit.com{submission.permalink}",
                score=submission.score,
                created_utc=datetime.fromtimestamp(submission.created_utc, tz=timezone.utc),
            ))

        return posts

    def fetch_post_by_id(self, post_id: str) -> Optional[RedditPost]:
        """Fetch a single post by its Reddit ID."""
        try:
            submission = self.reddit.submission(id=post_id)
            if submission.author is None:
                return None

            return RedditPost(
                reddit_id=submission.id,
                subreddit_name=submission.subreddit.display_name,
                author_name=str(submission.author),
                title=submission.title,
                body=submission.selftext or "",
                url=f"https://reddit.com{submission.permalink}",
                score=submission.score,
                created_utc=datetime.fromtimestamp(submission.created_utc, tz=timezone.utc),
            )
        except Exception:
            return None

    def verify_subreddit(self, subreddit_name: str) -> bool:
        """Check if a subreddit exists and is accessible."""
        try:
            subreddit = self.reddit.subreddit(subreddit_name)
            # Try to access a property to verify it exists
            _ = subreddit.id
            return True
        except Exception:
            return False
