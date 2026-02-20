import asyncio
import logging
from datetime import date, datetime, timedelta
from ..database import SessionLocal
from ..models import Company, Filing, PressRelease, ExecutiveCompensation
from .edgar import EdgarService
from .finnhub import FinnhubService
from .summarizer import SummarizerService

logger = logging.getLogger(__name__)

FORM_TYPES = ["10-K", "10-Q", "8-K", "4", "S-1", "DEF 14A"]


async def sync_all_companies():
    """Fetch new filings and press releases for all tracked companies. No AI summarization."""
    db = SessionLocal()
    try:
        companies = db.query(Company).all()
        if not companies:
            logger.info("Scheduled sync: no companies tracked, skipping")
            return

        edgar = EdgarService()
        finnhub = FinnhubService()
        fetched = 0
        skipped = 0
        pr_fetched = 0

        logger.info(f"Scheduled sync: starting for {len(companies)} companies")

        for company in companies:
            # --- SEC filings ---
            try:
                filings = await edgar.get_company_filings(
                    cik=company.cik,
                    form_types=FORM_TYPES,
                    limit=20,
                )

                for ef in filings:
                    existing = db.query(Filing).filter(
                        Filing.accession_number == ef.accession_number
                    ).first()
                    if existing:
                        skipped += 1
                        continue

                    db.add(Filing(
                        company_id=company.id,
                        accession_number=ef.accession_number,
                        form_type=ef.form_type,
                        filed_date=ef.filed_date,
                        document_url=ef.document_url,
                        headline=None,
                    ))
                    fetched += 1

                db.commit()

            except Exception as e:
                logger.error(f"Scheduled sync error for {company.ticker}: {e}")

            # Respect SEC's 10 req/sec rate limit
            await asyncio.sleep(0.5)

            # --- Press releases from Finnhub ---
            try:
                since_date = date.today() - timedelta(days=7)
                news_items = await finnhub.get_company_news(
                    symbol=company.ticker,
                    from_date=since_date,
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
                    pr_fetched += 1
                db.commit()
            except Exception as e:
                logger.error(f"Scheduled sync Finnhub error for {company.ticker}: {e}")

        logger.info(
            f"Scheduled sync complete: {fetched} new filings, {skipped} already stored, {pr_fetched} press releases"
        )

        # --- Executive compensation extraction ---
        await _sync_exec_comp(db, companies)

    finally:
        db.close()


async def _sync_exec_comp(db, companies):
    """Extract exec comp from DEF 14A filings for companies missing data."""
    edgar = EdgarService()
    summarizer = SummarizerService()
    extracted = 0

    for company in companies:
        # Skip if already have exec comp for this company
        existing = db.query(ExecutiveCompensation).filter(
            ExecutiveCompensation.company_id == company.id
        ).first()
        if existing:
            continue

        # Find DEF 14A in database
        filing = db.query(Filing).filter(
            Filing.company_id == company.id,
            Filing.form_type == "DEF 14A",
        ).order_by(Filing.filed_date.desc()).first()

        # If not in DB, fetch from EDGAR directly
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
            logger.info(f"Exec comp: extracting for {company.ticker}")
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
            extracted += len(comp_data)
            await asyncio.sleep(5)  # Rate limit Groq

        except Exception as e:
            logger.error(f"Exec comp: extraction failed for {company.ticker}: {e}")

    if extracted:
        logger.info(f"Exec comp sync: extracted {extracted} entries")
