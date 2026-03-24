from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import BearVsBullArgumentResponse, BearVsBullCreateRequest, BearVsBullResponse, BearVsBullVoteRequest
from ..services.auth import get_optional_current_user, require_current_user
from ..services.bear_vs_bull import (
    build_bear_vs_bull_response,
    create_community_post,
    create_vote,
    delete_community_post,
    get_anonymous_voter_hash,
    get_request_ip_hash,
    serialize_post_entry,
)

router = APIRouter(prefix="/api/bear-vs-bull", tags=["bear-vs-bull"])


@router.get("/", response_model=BearVsBullResponse)
def get_bear_vs_bull(
    request: Request,
    ticker: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return build_bear_vs_bull_response(
        db=db,
        ticker=ticker,
        current_user=current_user,
        anonymous_voter_hash=get_anonymous_voter_hash(request),
        ip_hash=get_request_ip_hash(request),
    )


@router.post("/posts", response_model=BearVsBullArgumentResponse)
def create_bear_vs_bull_post(
    payload: BearVsBullCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    post = create_community_post(
        db=db,
        ticker=payload.ticker,
        stance=payload.stance,
        title=payload.title,
        summary=payload.summary,
        user=current_user,
        source_type=payload.source_type,
        source_name=payload.source_name,
        source_url=str(payload.source_url) if payload.source_url else None,
        source_published_at=payload.source_published_at,
        external_id=payload.external_id,
    )
    return serialize_post_entry(post, {}, {}, current_user)


@router.delete("/posts/{post_id}")
def delete_bear_vs_bull_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    delete_community_post(db=db, post_id=post_id, user=current_user)
    return {"success": True}


@router.post("/{target_type}/{target_id}/vote")
def vote_on_bear_vs_bull(
    target_type: str,
    target_id: int,
    payload: BearVsBullVoteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    create_vote(
        db=db,
        target_type=target_type,
        target_id=target_id,
        direction=payload.direction,
        current_user=current_user,
        anonymous_voter_hash=get_anonymous_voter_hash(request),
        ip_hash=get_request_ip_hash(request),
    )
    return {"success": True}
