from datetime import date, datetime
import hashlib
import re

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from ..models import BearVsBullArgument, BearVsBullPost, BearVsBullVote, Company, User
from .auth import build_member_label


ANONYMOUS_VOTER_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{12,128}$")

TEMPLATES = {
    "bull": {
        "reddit": {
            "source_name": "Reddit",
            "author_handle": "r/investing",
            "title": "Supporters see long-term upside in execution and market position",
            "summary": "Bullish discussion often centers on durable demand, strategic positioning, and the idea that management can translate industry tailwinds into stronger revenue and cash flow over time.",
            "confidence_score": 0.70,
        },
        "seeking_alpha": {
            "source_name": "Seeking Alpha",
            "author_handle": None,
            "title": "The bull case focuses on multiple growth drivers",
            "summary": "Long theses usually highlight expanding addressable markets, improving fundamentals, and the possibility that the market is still underestimating the company's operating leverage.",
            "confidence_score": 0.75,
        },
    },
    "bear": {
        "x": {
            "source_name": "X",
            "author_handle": "@marketbear",
            "title": "Skeptics question whether expectations have run ahead of results",
            "summary": "Bearish takes typically point to execution risk, valuation pressure, and the chance that the market is pricing in a smoother path than the business can actually deliver.",
            "confidence_score": 0.67,
        },
        "reddit": {
            "source_name": "Reddit",
            "author_handle": "r/stocks",
            "title": "The bear case centers on downside scenarios investors may be ignoring",
            "summary": "Shorter theses often focus on slowing momentum, competitive threats, capital needs, or macro conditions that could make the next few quarters tougher than the consensus view.",
            "confidence_score": 0.64,
        },
    },
}


def ensure_seed_data(db: Session) -> None:
    companies = db.query(Company).order_by(Company.ticker.asc()).all()
    created = False

    for company in companies:
        existing_count = db.query(BearVsBullArgument).filter(BearVsBullArgument.company_id == company.id).count()
        if existing_count >= 2:
            continue

        if existing_count == 0:
            bull = TEMPLATES["bull"]["seeking_alpha"]
            bear = TEMPLATES["bear"]["x"]
            db.add(BearVsBullArgument(
                company_id=company.id,
                stance="bull",
                source_type="seeking_alpha",
                source_name=bull["source_name"],
                author_handle=bull["author_handle"],
                title=f"{company.ticker}: {bull['title']}",
                summary=f"{company.name}: {bull['summary']}",
                url=None,
                as_of_date=date(2026, 3, 1),
                confidence_score=bull["confidence_score"],
            ))
            db.add(BearVsBullArgument(
                company_id=company.id,
                stance="bear",
                source_type="x",
                source_name=bear["source_name"],
                author_handle=bear["author_handle"],
                title=f"{company.ticker}: {bear['title']}",
                summary=f"{company.name}: {bear['summary']}",
                url=None,
                as_of_date=date(2026, 3, 2),
                confidence_score=bear["confidence_score"],
            ))
            created = True

    if created:
        db.commit()


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _month_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    current = now or datetime.utcnow()
    month_start = datetime(current.year, current.month, 1)
    if current.month == 12:
        next_month = datetime(current.year + 1, 1, 1)
    else:
        next_month = datetime(current.year, current.month + 1, 1)
    return month_start, next_month


def get_request_ip_hash(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else ""
    if not client_ip and request.client:
        client_ip = request.client.host
    if not client_ip:
        client_ip = "unknown"
    return _hash_value(client_ip)


def get_anonymous_voter_hash(request: Request) -> str | None:
    anonymous_voter_id = request.headers.get("x-anonymous-voter-id", "").strip()
    if not anonymous_voter_id:
        return None
    if not ANONYMOUS_VOTER_ID_PATTERN.match(anonymous_voter_id):
        return None
    return _hash_value(anonymous_voter_id)


def _viewer_vote_matches(
    row: BearVsBullVote,
    current_user: User | None,
    anonymous_voter_hash: str | None,
    ip_hash: str,
) -> bool:
    if current_user:
        return row.user_id == current_user.id

    if anonymous_voter_hash and row.voter_ip_hash == anonymous_voter_hash:
        return True

    return row.voter_ip_hash == ip_hash


def _vote_maps(
    db: Session,
    target_type: str,
    target_ids: list[int],
    current_user: User | None,
    anonymous_voter_hash: str | None,
    ip_hash: str,
) -> tuple[dict[int, dict[str, int]], dict[int, str]]:
    if not target_ids:
        return {}, {}

    rows = db.query(BearVsBullVote).filter(
        BearVsBullVote.target_type == target_type,
        BearVsBullVote.target_id.in_(target_ids),
    ).all()

    totals: dict[int, dict[str, int]] = {}
    viewer_votes: dict[int, str] = {}

    for row in rows:
        bucket = totals.setdefault(row.target_id, {"up": 0, "down": 0})
        if row.direction == "up":
            bucket["up"] += 1
        else:
            bucket["down"] += 1

        if _viewer_vote_matches(row, current_user, anonymous_voter_hash, ip_hash):
            viewer_votes[row.target_id] = row.direction

    return totals, viewer_votes


def _serialize_argument(
    argument: BearVsBullArgument,
    vote_totals: dict[int, dict[str, int]],
    viewer_votes: dict[int, str],
) -> dict:
    totals = vote_totals.get(argument.id, {"up": 0, "down": 0})
    return {
        "id": argument.id,
        "entry_type": "argument",
        "ticker": argument.company.ticker,
        "company_name": argument.company.name,
        "stance": argument.stance,
        "source_type": argument.source_type,
        "source_name": argument.source_name,
        "author_handle": argument.author_handle,
        "title": argument.title,
        "summary": argument.summary,
        "url": argument.url,
        "as_of_date": argument.as_of_date,
        "confidence_score": argument.confidence_score,
        "vote_score": totals["up"] - totals["down"],
        "upvotes": totals["up"],
        "downvotes": totals["down"],
        "has_voted": argument.id in viewer_votes,
        "is_user_generated": False,
        "can_delete": False,
    }


def _serialize_post(
    post: BearVsBullPost,
    vote_totals: dict[int, dict[str, int]],
    viewer_votes: dict[int, str],
    current_user: User | None,
) -> dict:
    totals = vote_totals.get(post.id, {"up": 0, "down": 0})
    created_date = post.created_at.date() if post.created_at else date.today()
    return {
        "id": post.id,
        "entry_type": "post",
        "ticker": post.company.ticker,
        "company_name": post.company.name,
        "stance": post.stance,
        "source_type": "community",
        "source_name": "TickerClaw member",
        "author_handle": build_member_label(post.user_id),
        "title": post.title,
        "summary": post.summary,
        "url": None,
        "as_of_date": created_date,
        "confidence_score": None,
        "vote_score": totals["up"] - totals["down"],
        "upvotes": totals["up"],
        "downvotes": totals["down"],
        "has_voted": post.id in viewer_votes,
        "is_user_generated": True,
        "can_delete": bool(current_user and current_user.id == post.user_id),
    }


def build_bear_vs_bull_response(
    db: Session,
    ticker: str | None,
    current_user: User | None,
    anonymous_voter_hash: str | None,
    ip_hash: str,
) -> dict:
    ensure_seed_data(db)

    argument_query = db.query(BearVsBullArgument).join(Company)
    post_query = db.query(BearVsBullPost).join(Company)
    if ticker:
        ticker_value = ticker.upper()
        argument_query = argument_query.filter(Company.ticker == ticker_value)
        post_query = post_query.filter(Company.ticker == ticker_value)
    else:
        ticker_value = None

    arguments = argument_query.order_by(Company.ticker.asc(), BearVsBullArgument.as_of_date.desc()).all()
    posts = post_query.order_by(BearVsBullPost.created_at.desc()).all()

    argument_vote_totals, argument_viewer_votes = _vote_maps(
        db,
        "argument",
        [argument.id for argument in arguments],
        current_user,
        anonymous_voter_hash,
        ip_hash,
    )
    post_vote_totals, post_viewer_votes = _vote_maps(
        db,
        "post",
        [post.id for post in posts],
        current_user,
        anonymous_voter_hash,
        ip_hash,
    )

    bull_arguments: list[dict] = []
    bear_arguments: list[dict] = []

    for argument in arguments:
        item = _serialize_argument(argument, argument_vote_totals, argument_viewer_votes)
        if argument.stance == "bull":
            bull_arguments.append(item)
        else:
            bear_arguments.append(item)

    for post in posts:
        item = _serialize_post(post, post_vote_totals, post_viewer_votes, current_user)
        if post.stance == "bull":
            bull_arguments.append(item)
        else:
            bear_arguments.append(item)

    def sort_items(items: list[dict]) -> list[dict]:
        return sorted(
            items,
            key=lambda item: (
                item["vote_score"],
                item["upvotes"],
                item["as_of_date"].toordinal(),
                1 if item["is_user_generated"] else 0,
            ),
            reverse=True,
        )

    return {
        "ticker": ticker_value,
        "bull_arguments": sort_items(bull_arguments),
        "bear_arguments": sort_items(bear_arguments),
    }


def create_community_post(
    db: Session,
    ticker: str,
    stance: str,
    title: str,
    summary: str,
    user: User,
) -> BearVsBullPost:
    company = db.query(Company).filter(Company.ticker == ticker.upper().strip()).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    normalized_stance = stance.lower().strip()
    month_start, next_month = _month_window()
    existing_month_post = db.query(BearVsBullPost).filter(
        BearVsBullPost.company_id == company.id,
        BearVsBullPost.user_id == user.id,
        BearVsBullPost.stance == normalized_stance,
        BearVsBullPost.created_at >= month_start,
        BearVsBullPost.created_at < next_month,
    ).first()

    if existing_month_post:
        month_label = month_start.strftime("%B %Y")
        raise HTTPException(
            status_code=409,
            detail=f"You can only post one {normalized_stance} take for {company.ticker} during {month_label}",
        )

    post = BearVsBullPost(
        company_id=company.id,
        user_id=user.id,
        stance=normalized_stance,
        title=title.strip(),
        summary=summary.strip(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def delete_community_post(db: Session, post_id: int, user: User) -> None:
    post = db.query(BearVsBullPost).filter(BearVsBullPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    db.query(BearVsBullVote).filter(
        BearVsBullVote.target_type == "post",
        BearVsBullVote.target_id == post.id,
    ).delete()
    db.delete(post)
    db.commit()


def create_vote(
    db: Session,
    target_type: str,
    target_id: int,
    direction: str,
    current_user: User | None,
    anonymous_voter_hash: str | None,
    ip_hash: str,
) -> None:
    normalized_target_type = target_type.strip().lower()
    if normalized_target_type not in {"argument", "post"}:
        raise HTTPException(status_code=400, detail="Unsupported vote target")

    normalized_direction = direction.strip().lower()
    if normalized_direction not in {"up", "down"}:
        raise HTTPException(status_code=400, detail="Vote must be up or down")

    if normalized_target_type == "argument":
        target_exists = db.query(BearVsBullArgument.id).filter(BearVsBullArgument.id == target_id).first()
    else:
        target_exists = db.query(BearVsBullPost.id).filter(BearVsBullPost.id == target_id).first()

    if not target_exists:
        raise HTTPException(status_code=404, detail="Post not found")

    query = db.query(BearVsBullVote).filter(
        BearVsBullVote.target_type == normalized_target_type,
        BearVsBullVote.target_id == target_id,
    )
    if current_user:
        existing_vote = query.filter(BearVsBullVote.user_id == current_user.id).first()
    else:
        voter_identifiers = [ip_hash]
        if anonymous_voter_hash:
            voter_identifiers.insert(0, anonymous_voter_hash)
        existing_vote = query.filter(
            BearVsBullVote.user_id.is_(None),
            BearVsBullVote.voter_ip_hash.in_(voter_identifiers),
        ).first()

    if existing_vote:
        raise HTTPException(status_code=409, detail="You have already voted on this post")

    stored_anonymous_hash = anonymous_voter_hash or ip_hash
    db.add(BearVsBullVote(
        target_type=normalized_target_type,
        target_id=target_id,
        direction=normalized_direction,
        user_id=current_user.id if current_user else None,
        voter_ip_hash=None if current_user else stored_anonymous_hash,
    ))
    db.commit()
