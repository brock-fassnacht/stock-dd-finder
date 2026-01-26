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

    BASE_URL = "https://data.sec.gov"
    SUBMISSIONS_URL = "https://data.sec.gov/submissions"

    # Standard headers required by SEC
    HEADERS = {
        "User-Agent": "StockDDFinder contact@example.com",
        "Accept-Encoding": "gzip, deflate",
    }

    def __init__(self, user_agent: str = None):
        if user_agent:
            self.HEADERS["User-Agent"] = user_agent

    def _format_cik(self, cik: str) -> str:
        """Pad CIK to 10 digits."""
        return cik.zfill(10)

    async def get_company_filings(
        self,
        cik: str,
        form_types: List[str] = None,
        limit: int = 50,
    ) -> List[EdgarFiling]:
        """
        Fetch recent filings for a company.

        Args:
            cik: Company's Central Index Key
            form_types: Filter by form types (e.g., ["10-K", "10-Q", "8-K"])
            limit: Maximum number of filings to return
        """
        cik_padded = self._format_cik(cik)
        url = f"{self.SUBMISSIONS_URL}/CIK{cik_padded}.json"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.HEADERS)
            response.raise_for_status()
            data = response.json()

        filings = []
        recent = data.get("filings", {}).get("recent", {})

        if not recent:
            return filings

        accession_numbers = recent.get("accessionNumber", [])
        forms = recent.get("form", [])
        filing_dates = recent.get("filingDate", [])
        primary_documents = recent.get("primaryDocument", [])
        descriptions = recent.get("primaryDocDescription", [])

        for i in range(min(len(accession_numbers), limit * 2)):  # Fetch extra to filter
            form_type = forms[i] if i < len(forms) else ""

            # Filter by form type if specified
            if form_types and form_type not in form_types:
                continue

            accession = accession_numbers[i].replace("-", "")
            primary_doc = primary_documents[i] if i < len(primary_documents) else ""
            doc_url = f"{self.BASE_URL}/Archives/edgar/data/{cik}/{accession}/{primary_doc}"

            filed_date_str = filing_dates[i] if i < len(filing_dates) else ""
            try:
                filed_date = datetime.strptime(filed_date_str, "%Y-%m-%d").date()
            except ValueError:
                continue

            description = descriptions[i] if i < len(descriptions) else ""

            filings.append(EdgarFiling(
                accession_number=accession_numbers[i],
                form_type=form_type,
                filed_date=filed_date,
                document_url=doc_url,
                description=description,
            ))

            if len(filings) >= limit:
                break

        return filings

    async def lookup_cik(self, ticker: str) -> Optional[str]:
        """Look up a company's CIK by ticker symbol."""
        url = f"{self.BASE_URL}/cgi-bin/browse-edgar"
        params = {
            "action": "getcompany",
            "CIK": ticker,
            "type": "",
            "dateb": "",
            "owner": "include",
            "count": "1",
            "output": "atom",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=self.HEADERS)
            response.raise_for_status()

            # Parse CIK from response
            text = response.text
            if "CIK=" in text:
                start = text.find("CIK=") + 4
                end = text.find("&", start)
                if end == -1:
                    end = text.find('"', start)
                cik = text[start:end].strip()
                return cik.lstrip("0") or "0"

        return None


# Known CIKs for target companies
COMPANY_CIKS = {
    "ASTS": {"cik": "1780312", "name": "AST SpaceMobile, Inc."},
    "PLTR": {"cik": "1321655", "name": "Palantir Technologies Inc."},
    "TSLA": {"cik": "1318605", "name": "Tesla, Inc."},
    "IREN": {"cik": "1878848", "name": "Iris Energy Limited"},
}
