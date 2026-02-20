import asyncio
import logging
from dataclasses import dataclass
from datetime import date
from typing import List

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class FinnhubNewsItem:
    id: int
    headline: str
    source: str
    url: str
    datetime: int  # Unix timestamp


class FinnhubService:
    BASE_URL = "https://finnhub.io/api/v1"

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.finnhub_api_key

    async def get_company_news(
        self,
        symbol: str,
        from_date: date,
        to_date: date,
    ) -> List[FinnhubNewsItem]:
        """Fetch company news from Finnhub."""
        if not self.api_key:
            logger.warning("FINNHUB_API_KEY not set, skipping news fetch")
            return []

        url = f"{self.BASE_URL}/company-news"
        params = {
            "symbol": symbol.upper(),
            "from": from_date.isoformat(),
            "to": to_date.isoformat(),
            "token": self.api_key,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        if not isinstance(data, list):
            logger.warning(f"Unexpected Finnhub response for {symbol}: {data}")
            return []

        items = []
        for item in data:
            try:
                items.append(FinnhubNewsItem(
                    id=item["id"],
                    headline=item["headline"],
                    source=item.get("source", ""),
                    url=item["url"],
                    datetime=item["datetime"],
                ))
            except (KeyError, TypeError) as e:
                logger.debug(f"Skipping malformed news item: {e}")

        # Rate limit: ~1 request per second to stay well under 60/min
        await asyncio.sleep(1)

        return items
