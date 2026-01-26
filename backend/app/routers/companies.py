from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Company
from ..schemas import CompanyCreate, CompanyResponse
from ..services import COMPANY_CIKS

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    """List all tracked companies."""
    return db.query(Company).order_by(Company.ticker).all()


@router.post("", response_model=CompanyResponse)
def add_company(data: CompanyCreate, db: Session = Depends(get_db)):
    """Add a company to track by ticker."""
    ticker = data.ticker.upper()

    # Check if already exists
    existing = db.query(Company).filter(Company.ticker == ticker).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company already tracked")

    # Look up CIK from known list
    if ticker not in COMPANY_CIKS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown ticker. Supported: {', '.join(COMPANY_CIKS.keys())}"
        )

    company_info = COMPANY_CIKS[ticker]
    company = Company(
        ticker=ticker,
        name=company_info["name"],
        cik=company_info["cik"],
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{ticker}")
def remove_company(ticker: str, db: Session = Depends(get_db)):
    """Remove a company from tracking."""
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    db.delete(company)
    db.commit()
    return {"message": f"Removed {ticker.upper()}"}
