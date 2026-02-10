from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List
import yfinance as yf
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prices", tags=["prices"])


class Candle(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class PriceResponse(BaseModel):
    ticker: str
    candles: List[Candle]


@router.get("/{ticker}", response_model=PriceResponse)
async def get_prices(
    ticker: str,
    period: str = Query(default="1y", pattern="^(1mo|3mo|6mo|1y|2y|5y)$"),
):
    """
    Get historical OHLCV price data for a ticker.

    Period options: 1mo, 3mo, 6mo, 1y, 2y, 5y
    """
    try:
        stock = yf.Ticker(ticker.upper())
        hist = stock.history(period=period)

        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No price data found for {ticker}")

        candles = []
        for date, row in hist.iterrows():
            candles.append(Candle(
                date=date.strftime("%Y-%m-%d"),
                open=round(row["Open"], 2),
                high=round(row["High"], 2),
                low=round(row["Low"], 2),
                close=round(row["Close"], 2),
                volume=int(row["Volume"]),
            ))

        return PriceResponse(ticker=ticker.upper(), candles=candles)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prices for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch price data: {str(e)}")
