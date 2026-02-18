import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Company, InterestLog
from ..schemas import CompanyCreate, CompanyResponse
from ..services import TickerLookup

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/search")
async def search_tickers(q: str = Query(..., min_length=1, description="Search query")):
    """Search for tickers by symbol or company name."""
    lookup = TickerLookup.get_instance()
    results = await lookup.search(q, limit=10)
    return [
        {"ticker": r.ticker, "cik": r.cik, "name": r.name}
        for r in results
    ]


@router.get("", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    """List all tracked companies."""
    return db.query(Company).order_by(Company.ticker).all()


@router.post("", response_model=CompanyResponse)
async def add_company(data: CompanyCreate, db: Session = Depends(get_db)):
    """Add a company to track by ticker."""
    ticker = data.ticker.upper()

    # Check if already exists
    existing = db.query(Company).filter(Company.ticker == ticker).first()
    if existing:
        return existing

    # Look up CIK dynamically from SEC data
    lookup = TickerLookup.get_instance()
    info = await lookup.lookup(ticker)
    if not info:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown ticker: {ticker}"
        )

    company = Company(
        ticker=ticker,
        name=info.name,
        cik=info.cik,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.post("/interest")
def log_interest(
    ticker: str = Query(...),
    name: str = Query(...),
    db: Session = Depends(get_db),
):
    """Log user interest in an unsupported ticker."""
    ticker = ticker.upper()
    db.add(InterestLog(ticker=ticker, name=name))
    db.commit()
    logger.info(f"Interest logged: {ticker} ({name})")
    return {"message": "Interest noted"}


@router.delete("/{ticker}")
def remove_company(ticker: str, db: Session = Depends(get_db)):
    """Remove a company from tracking."""
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    db.delete(company)
    db.commit()
    return {"message": f"Removed {ticker.upper()}"}
