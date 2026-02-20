import asyncio
import logging
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from ..database import get_db, SessionLocal
from ..models import Company, Filing, PressRelease, ExecutiveCompensation
from ..schemas import FilingResponse, FilingDetail, TimelineResponse
from ..schemas.filing import TimelineEvent
from ..services import EdgarService, SummarizerService, FinnhubService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/filings", tags=["filings"])

FORM_TYPES = ["10-K", "10-Q", "8-K", "4", "S-1", "DEF 14A"]

# Module-level sync state — updated by the background task
_sync_state: dict = {
    "running": False,
    "fetched": 0,
    "skipped": 0,
    "pr_fetched": 0,
    "errors": [],
    "current": None,
    "message": "No sync has run yet",
    "started_at": None,
    "completed_at": None,
}


async def _run_sync():
    global _sync_state
    _sync_state = {
        "running": True,
        "fetched": 0,
        "skipped": 0,
        "pr_fetched": 0,
        "errors": [],
        "current": None,
        "message": "Starting sync...",
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
    }

    db = SessionLocal()
    try:
        companies = db.query(Company).all()
        if not companies:
            _sync_state.update({"running": False, "message": "No companies tracked"})
            return

        edgar = EdgarService()
        summarizer = SummarizerService()
        finnhub = FinnhubService()
        since_date = date.today() - timedelta(days=365)

        logger.info(f"Full sync started for {len(companies)} companies since {since_date}")

        for company in companies:
            _sync_state["current"] = company.ticker
            _sync_state["message"] = f"Fetching filings for {company.ticker}..."
            try:
                filings = await edgar.get_company_filings(
                    cik=company.cik,
                    form_types=FORM_TYPES,
                    limit=200,
                    since_date=since_date,
                )

                for ef in filings:
                    existing = db.query(Filing).filter(
                        Filing.accession_number == ef.accession_number
                    ).first()
                    if existing:
                        _sync_state["skipped"] += 1
                        continue

                    # Skip Groq summarization for Form 4 — high volume, low value
                    headline = None
                    if ef.form_type != "4":
                        for attempt in range(3):
                            try:
                                _sync_state["message"] = (
                                    f"{company.ticker}: summarizing {ef.form_type} "
                                    f"filed {ef.filed_date}..."
                                )
                                # 5,000 chars ≈ 1,250 tokens — enough for a good
                                # summary while staying under Groq's 6,000 TPM limit
                                text = await summarizer.fetch_filing_text(
                                    ef.document_url, max_chars=5000
                                )
                                headline = summarizer.generate_headline(
                                    ef.form_type, company.name, text
                                )
                                # ~2,700 tokens/call × 2.7 calls/min ≈ 7,300 TPM
                                await asyncio.sleep(22)
                                break
                            except Exception as e:
                                if attempt < 2:
                                    _sync_state["message"] = (
                                        f"{company.ticker}: rate limited, "
                                        f"waiting 60s (attempt {attempt + 1}/3)..."
                                    )
                                    await asyncio.sleep(60)
                                else:
                                    _sync_state["errors"].append(
                                        f"{company.ticker} {ef.form_type}: {str(e)}"
                                    )

                    db.add(Filing(
                        company_id=company.id,
                        accession_number=ef.accession_number,
                        form_type=ef.form_type,
                        filed_date=ef.filed_date,
                        document_url=ef.document_url,
                        headline=headline,
                    ))
                    _sync_state["fetched"] += 1

                db.commit()
                await asyncio.sleep(0.5)  # SEC rate limit between companies

                # Fetch press releases from Finnhub
                _sync_state["message"] = f"Fetching news for {company.ticker}..."
                try:
                    news_items = await finnhub.get_company_news(
                        symbol=company.ticker,
                        from_date=date.today() - timedelta(days=7),
                        to_date=date.today(),
                    )
                    for item in news_items:
                        existing_pr = db.query(PressRelease).filter(
                            PressRelease.finnhub_id == item.id
                        ).first()
                        if existing_pr:
                            continue
                        db.add(PressRelease(
                            company_id=company.id,
                            finnhub_id=item.id,
                            headline=item.headline,
                            source=item.source,
                            url=item.url,
                            published_at=datetime.fromtimestamp(item.datetime),
                        ))
                        _sync_state["pr_fetched"] += 1
                    db.commit()
                except Exception as e:
                    _sync_state["errors"].append(
                        f"{company.ticker} news: {str(e)}"
                    )
                    logger.error(f"Finnhub error for {company.ticker}: {e}")

            except Exception as e:
                _sync_state["errors"].append(f"{company.ticker}: {str(e)}")
                logger.error(f"Sync error for {company.ticker}: {e}")

        # --- Executive compensation extraction ---
        _sync_state["message"] = "Extracting executive compensation..."
        try:
            exec_extracted = 0
            for company in companies:
                existing = db.query(ExecutiveCompensation).filter(
                    ExecutiveCompensation.company_id == company.id
                ).first()
                if existing:
                    continue

                filing = db.query(Filing).filter(
                    Filing.company_id == company.id,
                    Filing.form_type == "DEF 14A",
                ).order_by(Filing.filed_date.desc()).first()

                if not filing:
                    try:
                        edgar_filings = await edgar.get_company_filings(
                            cik=company.cik, form_types=["DEF 14A"], limit=1,
                        )
                        if not edgar_filings:
                            continue
                        ef = edgar_filings[0]
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
                    except Exception as e:
                        logger.error(f"Exec comp: failed to fetch DEF 14A for {company.ticker}: {e}")
                        continue

                try:
                    _sync_state["message"] = f"Extracting exec comp for {company.ticker}..."
                    text = await summarizer.fetch_compensation_section(filing.document_url)
                    comp_data = summarizer.extract_executive_compensation(company.name, text)
                    for entry in comp_data:
                        db.add(ExecutiveCompensation(
                            filing_id=filing.id,
                            company_id=company.id,
                            executive_name=entry.get("name", "Unknown"),
                            position=entry.get("position"),
                            total_compensation=entry.get("total_compensation"),
                            salary=entry.get("salary"),
                            bonus=entry.get("bonus"),
                            stock_awards=entry.get("stock_awards"),
                            option_awards=entry.get("option_awards"),
                            other_compensation=entry.get("other_compensation"),
                            fiscal_year=entry.get("fiscal_year"),
                            filed_date=filing.filed_date,
                        ))
                    db.commit()
                    exec_extracted += len(comp_data)
                    await asyncio.sleep(5)
                except Exception as e:
                    logger.error(f"Exec comp extraction failed for {company.ticker}: {e}")

            if exec_extracted:
                logger.info(f"Exec comp sync: extracted {exec_extracted} entries")
        except Exception as e:
            logger.error(f"Exec comp sync failed: {e}")

        fetched = _sync_state["fetched"]
        skipped = _sync_state["skipped"]
        pr_fetched = _sync_state["pr_fetched"]
        _sync_state.update({
            "running": False,
            "current": None,
            "message": f"Done — {fetched} new filings, {skipped} already stored, {pr_fetched} press releases",
            "completed_at": datetime.utcnow().isoformat(),
        })
        logger.info(f"Full sync complete: {fetched} fetched, {skipped} skipped, {pr_fetched} press releases")

    except Exception as e:
        _sync_state.update({
            "running": False,
            "current": None,
            "message": f"Sync failed: {str(e)}",
            "completed_at": datetime.utcnow().isoformat(),
        })
        logger.error(f"Sync failed: {e}")
    finally:
        db.close()


@router.get("/sync-status")
def get_sync_status():
    """Get the current status of a running or completed sync."""
    return _sync_state


@router.post("/sync")
async def start_sync(background_tasks: BackgroundTasks):
    """Start a full sync of all tracked companies with AI summarization."""
    if _sync_state["running"]:
        return {"message": "Sync already in progress", "status": _sync_state}
    background_tasks.add_task(_run_sync)
    return {"message": "Sync started"}


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
    """Get timeline of filings and press releases across all companies."""
    events: List[TimelineEvent] = []

    # --- Filings ---
    exclude_pr = exclude_form_types and "PR" in exclude_form_types
    filing_excludes = [ft for ft in (exclude_form_types or []) if ft != "PR"]

    filing_query = db.query(Filing).join(Company)
    if ticker:
        filing_query = filing_query.filter(Company.ticker == ticker.upper())
    if form_type and form_type != "PR":
        filing_query = filing_query.filter(Filing.form_type == form_type)
    if filing_excludes:
        filing_query = filing_query.filter(Filing.form_type.notin_(filing_excludes))
    if start_date:
        filing_query = filing_query.filter(Filing.filed_date >= start_date)
    if end_date:
        filing_query = filing_query.filter(Filing.filed_date <= end_date)

    # If filtering to only PR, skip filings entirely
    if form_type != "PR":
        for f in filing_query.all():
            events.append(TimelineEvent(
                id=f.id,
                ticker=f.company.ticker,
                company_name=f.company.name,
                form_type=f.form_type,
                form_type_description=get_form_description(f.form_type),
                filed_date=f.filed_date,
                headline=f.headline,
                document_url=f.document_url,
                event_type="filing",
            ))

    # --- Press Releases ---
    if not exclude_pr:
        pr_query = db.query(PressRelease).join(Company)
        if ticker:
            pr_query = pr_query.filter(Company.ticker == ticker.upper())
        if form_type and form_type != "PR":
            # User is filtering to a specific filing type, skip PRs
            pass
        else:
            if start_date:
                pr_query = pr_query.filter(PressRelease.published_at >= start_date)
            if end_date:
                pr_query = pr_query.filter(PressRelease.published_at <= end_date)

            for pr in pr_query.all():
                events.append(TimelineEvent(
                    id=pr.id,
                    ticker=pr.company.ticker,
                    company_name=pr.company.name,
                    form_type="PR",
                    form_type_description="News",
                    filed_date=pr.published_at.date() if hasattr(pr.published_at, 'date') else pr.published_at,
                    headline=pr.headline,
                    document_url=pr.url,
                    event_type="press_release",
                ))

    # Sort merged events by date descending, apply limit
    events.sort(key=lambda e: e.filed_date, reverse=True)
    total = len(events)
    events = events[:limit]

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
