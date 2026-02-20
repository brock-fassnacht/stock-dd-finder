import asyncio
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from typing import Optional

from ..database import get_db
from ..models import Company, Filing, ExecutiveCompensation
from ..services.summarizer import SummarizerService
from ..services.edgar import EdgarService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exec-comp", tags=["executive-compensation"])


@router.get("/")
def get_executive_compensation(
    ticker: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get executive compensation data for tracked companies (most recent year only)."""
    # Find the max fiscal_year per company
    max_year_subq = db.query(
        ExecutiveCompensation.company_id,
        sqlfunc.max(ExecutiveCompensation.fiscal_year).label("max_year"),
    ).group_by(ExecutiveCompensation.company_id).subquery()

    query = (
        db.query(ExecutiveCompensation)
        .join(Company)
        .join(
            max_year_subq,
            (ExecutiveCompensation.company_id == max_year_subq.c.company_id)
            & (ExecutiveCompensation.fiscal_year == max_year_subq.c.max_year),
        )
    )

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
    """Extract exec comp from most recent DEF 14A filings.

    If a company has no DEF 14A in the database, fetches directly from EDGAR.
    """
    company_query = db.query(Company)
    if ticker:
        company_query = company_query.filter(Company.ticker == ticker.upper())
    companies = company_query.all()

    edgar = EdgarService()
    summarizer = SummarizerService()
    results = {"extracted": 0, "skipped": 0, "errors": []}

    for company in companies:
        try:
            # Check if already extracted for this company
            existing = db.query(ExecutiveCompensation).filter(
                ExecutiveCompensation.company_id == company.id
            ).first()
            if existing:
                results["skipped"] += 1
                continue

            # Find DEF 14A in database
            filing = db.query(Filing).filter(
                Filing.company_id == company.id,
                Filing.form_type == "DEF 14A",
            ).order_by(Filing.filed_date.desc()).first()

            # If not in DB, fetch from EDGAR directly
            if not filing:
                logger.info(f"No DEF 14A in DB for {company.ticker}, fetching from EDGAR...")
                edgar_filings = await edgar.get_company_filings(
                    cik=company.cik,
                    form_types=["DEF 14A"],
                    limit=1,
                )
                if not edgar_filings:
                    logger.info(f"No DEF 14A found on EDGAR for {company.ticker}")
                    continue

                ef = edgar_filings[0]
                # Check if this filing already exists (by accession number)
                existing_filing = db.query(Filing).filter(
                    Filing.accession_number == ef.accession_number
                ).first()
                if existing_filing:
                    filing = existing_filing
                else:
                    filing = Filing(
                        company_id=company.id,
                        accession_number=ef.accession_number,
                        form_type=ef.form_type,
                        filed_date=ef.filed_date,
                        document_url=ef.document_url,
                    )
                    db.add(filing)
                    db.commit()
                    db.refresh(filing)
                    logger.info(f"Fetched DEF 14A for {company.ticker} filed {ef.filed_date}")

                await asyncio.sleep(0.5)  # SEC rate limit

            logger.info(f"Extracting exec comp for {company.ticker} from filing {filing.id}")
            text = await summarizer.fetch_compensation_section(filing.document_url)
            comp_data = summarizer.extract_executive_compensation(
                company.name, text
            )

            for exec_entry in comp_data:
                if not exec_entry.get("name"):
                    continue
                db.add(ExecutiveCompensation(
                    filing_id=filing.id,
                    company_id=company.id,
                    executive_name=exec_entry["name"],
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
            logger.info(f"Extracted {len(comp_data)} executives for {company.ticker}")

            # Rate limit Groq calls
            await asyncio.sleep(5)

        except Exception as e:
            db.rollback()
            results["errors"].append(f"{company.ticker}: {str(e)}")
            logger.error(f"Exec comp extraction failed for {company.ticker}: {e}")

    return results
