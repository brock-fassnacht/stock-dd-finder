from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BearVsBullArgument, Company
from ..schemas import BearVsBullResponse
from ..services.bear_vs_bull import ensure_seed_data

router = APIRouter(prefix="/api/bear-vs-bull", tags=["bear-vs-bull"])


@router.get("/", response_model=BearVsBullResponse)
def get_bear_vs_bull(
    ticker: str | None = Query(None),
    db: Session = Depends(get_db),
):
    ensure_seed_data(db)

    query = db.query(BearVsBullArgument).join(Company)
    if ticker:
        query = query.filter(Company.ticker == ticker.upper())

    arguments = query.order_by(
        Company.ticker.asc(),
        BearVsBullArgument.stance.asc(),
        BearVsBullArgument.as_of_date.desc(),
    ).all()

    bull_arguments = []
    bear_arguments = []

    for argument in arguments:
        item = {
            "id": argument.id,
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
        }
        if argument.stance == "bull":
            bull_arguments.append(item)
        else:
            bear_arguments.append(item)

    return {
        "ticker": ticker.upper() if ticker else None,
        "bull_arguments": bull_arguments,
        "bear_arguments": bear_arguments,
    }
