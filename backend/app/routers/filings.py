from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import date
from ..database import get_db
from ..models import Company, Filing
from ..schemas import FilingResponse, FilingDetail, TimelineResponse
from ..schemas.filing import TimelineEvent
from ..services import EdgarService, SummarizerService

router = APIRouter(prefix="/api/filings", tags=["filings"])


def get_form_description(form_type: str) -> str:
    descriptions = {
        "10-K": "Annual Report",
        "10-Q": "Quarterly Report",
        "8-K": "Current Report",
        "4": "Insider Trading",
        "S-1": "IPO Registration",
        "DEF 14A": "Proxy Statement",
        "SC 13G": "Ownership Report",
        "SC 13D": "Ownership Report",
    }
    return descriptions.get(form_type, form_type)


@router.get("/timeline", response_model=TimelineResponse)
def get_timeline(
    ticker: Optional[str] = Query(None, description="Filter by ticker"),
    form_type: Optional[str] = Query(None, description="Filter by form type"),
    exclude_form_types: Optional[List[str]] = Query(default=None, description="Form types to exclude"),
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Get timeline of filings across all companies."""
    query = db.query(Filing).join(Company)

    if ticker:
        query = query.filter(Company.ticker == ticker.upper())
    if form_type:
        query = query.filter(Filing.form_type == form_type)
    if exclude_form_types:
        query = query.filter(Filing.form_type.notin_(exclude_form_types))
    if start_date:
        query = query.filter(Filing.filed_date >= start_date)
    if end_date:
        query = query.filter(Filing.filed_date <= end_date)

    total = query.count()
    filings = query.order_by(desc(Filing.filed_date)).limit(limit).all()

    events = []
    for f in filings:
        events.append(TimelineEvent(
            id=f.id,
            ticker=f.company.ticker,
            company_name=f.company.name,
            form_type=f.form_type,
            form_type_description=get_form_description(f.form_type),
            filed_date=f.filed_date,
            headline=f.headline,
            document_url=f.document_url,
        ))

    return TimelineResponse(events=events, total=total)


@router.get("/{filing_id}", response_model=FilingDetail)
def get_filing(filing_id: int, db: Session = Depends(get_db)):
    """Get details of a specific filing."""
    filing = db.query(Filing).filter(Filing.id == filing_id).first()
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")

    return FilingDetail(
        id=filing.id,
        company_id=filing.company_id,
        accession_number=filing.accession_number,
        form_type=filing.form_type,
        form_type_description=get_form_description(filing.form_type),
        filed_date=filing.filed_date,
        document_url=filing.document_url,
        headline=filing.headline,
        summary=filing.summary,
        created_at=filing.created_at,
        company_ticker=filing.company.ticker,
        company_name=filing.company.name,
    )


@router.post("/fetch")
async def fetch_filings(
    background_tasks: BackgroundTasks,
    ticker: Optional[str] = Query(None, description="Specific ticker to fetch"),
    limit: int = Query(20, ge=1, le=100),
    summarize: bool = Query(True, description="Generate AI headlines"),
    db: Session = Depends(get_db),
):
    """Fetch new filings from SEC EDGAR."""
    if ticker:
        companies = db.query(Company).filter(Company.ticker == ticker.upper()).all()
        if not companies:
            raise HTTPException(status_code=404, detail="Company not tracked")
    else:
        companies = db.query(Company).all()
        if not companies:
            raise HTTPException(status_code=400, detail="No companies tracked")

    # Fetch synchronously for now (can move to background later)
    edgar = EdgarService()
    summarizer = SummarizerService() if summarize else None

    results = {"fetched": 0, "skipped": 0, "errors": []}

    for company in companies:
        try:
            filings = await edgar.get_company_filings(
                cik=company.cik,
                form_types=["10-K", "10-Q", "8-K", "4", "S-1", "DEF 14A"],
                limit=limit,
            )

            for ef in filings:
                # Skip if already exists
                existing = db.query(Filing).filter(
                    Filing.accession_number == ef.accession_number
                ).first()
                if existing:
                    results["skipped"] += 1
                    continue

                # Generate headline if enabled
                headline = None
                if summarizer:
                    try:
                        text = await summarizer.fetch_filing_text(ef.document_url)
                        headline = summarizer.generate_headline(
                            ef.form_type,
                            company.name,
                            text,
                        )
                    except Exception as e:
                        results["errors"].append(f"Summary failed for {ef.accession_number}: {str(e)}")

                filing = Filing(
                    company_id=company.id,
                    accession_number=ef.accession_number,
                    form_type=ef.form_type,
                    filed_date=ef.filed_date,
                    document_url=ef.document_url,
                    headline=headline,
                )
                db.add(filing)
                results["fetched"] += 1

            db.commit()

        except Exception as e:
            results["errors"].append(f"Error fetching {company.ticker}: {str(e)}")

    return results


@router.post("/resummarize")
async def resummarize_filings(
    ticker: Optional[str] = Query(None, description="Specific ticker to resummarize"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Generate AI headlines for filings that don't have them."""
    query = db.query(Filing).join(Company).filter(Filing.headline.is_(None))

    if ticker:
        query = query.filter(Company.ticker == ticker.upper())

    filings = query.limit(limit).all()

    if not filings:
        return {"summarized": 0, "errors": [], "message": "No filings need summarization"}

    summarizer = SummarizerService()
    results = {"summarized": 0, "errors": []}

    for filing in filings:
        try:
            text = await summarizer.fetch_filing_text(filing.document_url)
            headline = summarizer.generate_headline(
                filing.form_type,
                filing.company.name,
                text,
            )
            filing.headline = headline
            results["summarized"] += 1
        except Exception as e:
            results["errors"].append(f"Failed {filing.accession_number}: {str(e)}")

    db.commit()
    return results
