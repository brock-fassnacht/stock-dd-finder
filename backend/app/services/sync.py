import asyncio
import logging
from ..database import SessionLocal
from ..models import Company, Filing
from .edgar import EdgarService

logger = logging.getLogger(__name__)

FORM_TYPES = ["10-K", "10-Q", "8-K", "4", "S-1", "DEF 14A"]


async def sync_all_companies():
    """Fetch new filings for all tracked companies. No AI summarization."""
    db = SessionLocal()
    try:
        companies = db.query(Company).all()
        if not companies:
            logger.info("Scheduled sync: no companies tracked, skipping")
            return

        edgar = EdgarService()
        fetched = 0
        skipped = 0

        logger.info(f"Scheduled sync: starting for {len(companies)} companies")

        for company in companies:
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

        logger.info(
            f"Scheduled sync complete: {fetched} new, {skipped} already stored"
        )

    finally:
        db.close()
