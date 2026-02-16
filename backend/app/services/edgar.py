import httpx
import time
from datetime import date, datetime
from typing import List, Optional, Dict
from dataclasses import dataclass


@dataclass
class EdgarFiling:
    accession_number: str
    form_type: str
    filed_date: date
    document_url: str
    description: str


@dataclass
class TickerInfo:
    ticker: str
    cik: str
    name: str


class TickerLookup:
    """Downloads and caches SEC's company_tickers.json for ticker/CIK lookup."""

    TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
    HEADERS = {
        "User-Agent": "StockDDFinder brock@example.com",
        "Accept-Encoding": "gzip, deflate",
    }
    CACHE_TTL = 3600 * 24  # 24 hours

    _instance = None

    def __init__(self):
        self._tickers: List[TickerInfo] = []
        self._by_ticker: Dict[str, TickerInfo] = {}
        self._loaded_at: float = 0

    @classmethod
    def get_instance(cls) -> "TickerLookup":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def _ensure_loaded(self):
        if self._tickers and (time.time() - self._loaded_at) < self.CACHE_TTL:
            return
        async with httpx.AsyncClient() as client:
            response = await client.get(self.TICKERS_URL, headers=self.HEADERS, timeout=30.0)
            response.raise_for_status()
            data = response.json()

        tickers = []
        by_ticker = {}
        for entry in data.values():
            info = TickerInfo(
                ticker=entry["ticker"].upper(),
                cik=str(entry["cik_str"]),
                name=entry["title"],
            )
            tickers.append(info)
            by_ticker[info.ticker] = info

        self._tickers = tickers
        self._by_ticker = by_ticker
        self._loaded_at = time.time()

    async def search(self, query: str, limit: int = 10) -> List[TickerInfo]:
        """Fuzzy-match tickers and company names."""
        await self._ensure_loaded()
        query_upper = query.upper().strip()
        if not query_upper:
            return []

        exact = []
        starts_with = []
        contains = []

        for info in self._tickers:
            if info.ticker == query_upper:
                exact.append(info)
            elif info.ticker.startswith(query_upper):
                starts_with.append(info)
            elif query_upper in info.name.upper():
                contains.append(info)

        results = exact + starts_with + contains
        return results[:limit]

    async def lookup(self, ticker: str) -> Optional[TickerInfo]:
        """Look up a specific ticker."""
        await self._ensure_loaded()
        return self._by_ticker.get(ticker.upper())


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


