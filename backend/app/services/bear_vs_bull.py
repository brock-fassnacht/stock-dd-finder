from datetime import date

from sqlalchemy.orm import Session

from ..models import BearVsBullArgument, Company


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
