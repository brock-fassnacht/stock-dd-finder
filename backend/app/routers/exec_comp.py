import asyncio
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Company, Filing, ExecutiveCompensation
from ..services.summarizer import SummarizerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exec-comp", tags=["executive-compensation"])


@router.get("/")
def get_executive_compensation(
    ticker: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get executive compensation data for tracked companies."""
    query = db.query(ExecutiveCompensation).join(Company)

    if ticker:
        query = query.filter(Company.ticker == ticker.upper())

    results = query.order_by(
        Company.ticker,
        ExecutiveCompensation.total_compensation.desc()
    ).all()

    return [
        {
            "id": r.id,
            "ticker": r.company.ticker,
            "company_name": r.company.name,
            "executive_name": r.executive_name,
            "position": r.position,
            "total_compensation": r.total_compensation,
            "salary": r.salary,
            "bonus": r.bonus,
            "stock_awards": r.stock_awards,
            "option_awards": r.option_awards,
            "other_compensation": r.other_compensation,
            "fiscal_year": r.fiscal_year,
            "filed_date": r.filed_date.isoformat() if r.filed_date else None,
            "document_url": r.filing.document_url if r.filing else None,
        }
        for r in results
    ]


@router.post("/extract")
async def extract_compensation(
    ticker: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Extract exec comp from most recent DEF 14A filings."""
    query = db.query(Filing).join(Company).filter(Filing.form_type == "DEF 14A")

    if ticker:
        query = query.filter(Company.ticker == ticker.upper())

    filings = query.order_by(Filing.filed_date.desc()).all()

    # Deduplicate to most recent per company
    seen_companies: set[int] = set()
    target_filings = []
    for f in filings:
        if f.company_id not in seen_companies:
            seen_companies.add(f.company_id)
            target_filings.append(f)

    summarizer = SummarizerService()
    results = {"extracted": 0, "skipped": 0, "errors": []}

    for filing in target_filings:
        # Skip if already extracted
        existing = db.query(ExecutiveCompensation).filter(
            ExecutiveCompensation.filing_id == filing.id
        ).first()
        if existing:
            results["skipped"] += 1
            continue

        try:
            logger.info(f"Extracting exec comp for {filing.company.ticker} from filing {filing.id}")
            text = await summarizer.fetch_compensation_section(filing.document_url)
            comp_data = summarizer.extract_executive_compensation(
                filing.company.name, text
            )

            for exec_entry in comp_data:
                db.add(ExecutiveCompensation(
                    filing_id=filing.id,
                    company_id=filing.company_id,
                    executive_name=exec_entry.get("name", "Unknown"),
                    position=exec_entry.get("position"),
                    total_compensation=exec_entry.get("total_compensation"),
                    salary=exec_entry.get("salary"),
                    bonus=exec_entry.get("bonus"),
                    stock_awards=exec_entry.get("stock_awards"),
                    option_awards=exec_entry.get("option_awards"),
                    other_compensation=exec_entry.get("other_compensation"),
                    fiscal_year=exec_entry.get("fiscal_year"),
                    filed_date=filing.filed_date,
                ))

            db.commit()
            results["extracted"] += len(comp_data)
            logger.info(f"Extracted {len(comp_data)} executives for {filing.company.ticker}")

            # Rate limit Groq calls
            await asyncio.sleep(5)

        except Exception as e:
            results["errors"].append(f"{filing.company.ticker}: {str(e)}")
            logger.error(f"Exec comp extraction failed for {filing.company.ticker}: {e}")

    return results
