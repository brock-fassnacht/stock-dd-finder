import httpx
from datetime import date, datetime
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class EdgarFiling:
    accession_number: str
    form_type: str
    filed_date: date
    document_url: str
    description: str


class EdgarService:
    """Service for fetching SEC EDGAR filings."""

    BASE_URL = "https://www.sec.gov"
    SUBMISSIONS_URL = "https://data.sec.gov/submissions"

    HEADERS = {
        "User-Agent": "StockDDFinder brock@example.com",
        "Accept-Encoding": "gzip, deflate",
    }

    def _format_cik(self, cik: str) -> str:
        """Pad CIK to 10 digits."""
        return cik.zfill(10)

    async def get_company_filings(
        self,
        cik: str,
        form_types: List[str] = None,
        limit: int = 50,
    ) -> List[EdgarFiling]:
        """Fetch recent filings for a company."""
        cik_padded = self._format_cik(cik)
        url = f"{self.SUBMISSIONS_URL}/CIK{cik_padded}.json"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.HEADERS, timeout=30.0)
            response.raise_for_status()
            data = response.json()

        filings = []
        recent = data.get("filings", {}).get("recent", {})

        if not recent:
            return filings

        accession_numbers = recent.get("accessionNumber", [])
        forms = recent.get("form", [])
        filing_dates = recent.get("filingDate", [])
        descriptions = recent.get("primaryDocDescription", [])
        primary_docs = recent.get("primaryDocument", [])

        for i in range(min(len(accession_numbers), limit * 2)):
            form_type = forms[i] if i < len(forms) else ""

            if form_types and form_type not in form_types:
                continue

            accession = accession_numbers[i]
            accession_no_dash = accession.replace("-", "")
            primary_doc = primary_docs[i] if i < len(primary_docs) else ""

            # Link directly to the primary document
            doc_url = f"{self.BASE_URL}/Archives/edgar/data/{cik}/{accession_no_dash}/{primary_doc}"

            filed_date_str = filing_dates[i] if i < len(filing_dates) else ""
            try:
                filed_date = datetime.strptime(filed_date_str, "%Y-%m-%d").date()
            except ValueError:
                continue

            description = descriptions[i] if i < len(descriptions) else ""

            filings.append(EdgarFiling(
                accession_number=accession,
                form_type=form_type,
                filed_date=filed_date,
                document_url=doc_url,
                description=description,
            ))

            if len(filings) >= limit:
                break

        return filings


# Known CIKs for target companies
COMPANY_CIKS = {
    "ASTS": {"cik": "1780312", "name": "AST SpaceMobile, Inc."},
    "PLTR": {"cik": "1321655", "name": "Palantir Technologies Inc."},
    "TSLA": {"cik": "1318605", "name": "Tesla, Inc."},
    "IREN": {"cik": "1878848", "name": "Iris Energy Limited"},
}
