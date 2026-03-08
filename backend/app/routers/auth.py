from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuthSession, User
from ..schemas import AuthSessionResponse, LoginRequest, RegisterRequest, UserResponse
from ..services.auth import (
    build_member_label,
    create_session,
    get_optional_current_user,
    hash_password,
    hash_session_token,
    normalize_email,
    parse_bearer_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        member_label=build_member_label(user.id),
        created_at=user.created_at,
    )


@router.post("/register", response_model=AuthSessionResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_session(db, user)
    return {"token": token, "user": serialize_user(user)}


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_session(db, user)
    return {"token": token, "user": serialize_user(user)}


@router.get("/me", response_model=UserResponse)
def me(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Please log in to continue")
    return serialize_user(current_user)


@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    token = parse_bearer_token(authorization)
    if token:
        db.query(AuthSession).filter(AuthSession.token_hash == hash_session_token(token)).delete()
        db.commit()
    return {"success": True}
