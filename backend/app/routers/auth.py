import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuthSession, User
from ..schemas import (
    AgentAccountCreateRequest,
    AgentAccountProvisionResponse,
    AgentApiKeyCreateRequest,
    AgentApiKeyCreateResponse,
    AgentApiKeyListResponse,
    AgentApiKeyResponse,
    AuthSessionResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from ..services.auth import (
    DEFAULT_MEMBER_POST_LIMIT,
    build_user_label,
    create_agent_api_key,
    create_session,
    get_optional_current_user,
    hash_password,
    hash_session_token,
    list_agent_api_keys,
    normalize_account_type,
    normalize_email,
    parse_bearer_token,
    require_admin_key,
    revoke_agent_api_key,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        member_label=build_user_label(user),
        account_type=user.account_type,
        monthly_post_limit_per_stance=user.monthly_post_limit_per_stance,
        created_at=user.created_at,
    )


def serialize_api_key(key) -> AgentApiKeyResponse:
    return AgentApiKeyResponse(
        id=key.id,
        label=key.label,
        last_used_at=key.last_used_at,
        revoked_at=key.revoked_at,
        created_at=key.created_at,
    )


def get_agent_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or normalize_account_type(user.account_type) != "agent":
        raise HTTPException(status_code=404, detail="Agent account not found")
    return user


@router.post("/register", response_model=AuthSessionResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        account_type="member",
        monthly_post_limit_per_stance=DEFAULT_MEMBER_POST_LIMIT,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_session(db, user)
    return {"token": token, "user": serialize_user(user)}


@router.post("/agent-accounts", response_model=AgentAccountProvisionResponse)
def create_agent_account(
    payload: AgentAccountCreateRequest,
    _: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
):
    email = normalize_email(payload.email)
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    password = payload.password or secrets.token_urlsafe(18)
    display_name = payload.display_name or email.split("@", 1)[0]

    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
        account_type="agent",
        monthly_post_limit_per_stance=payload.monthly_post_limit_per_stance,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_session(db, user)
    return {
        "email": user.email,
        "password": password,
        "token": token,
        "user": serialize_user(user),
    }


@router.get("/agent-accounts/{user_id}/keys", response_model=AgentApiKeyListResponse)
def get_agent_keys(
    user_id: int,
    _: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
):
    user = get_agent_user_or_404(db, user_id)
    return {
        "agent": serialize_user(user),
        "keys": [serialize_api_key(key) for key in list_agent_api_keys(db, user)],
    }


@router.post("/agent-accounts/{user_id}/keys", response_model=AgentApiKeyCreateResponse)
def create_agent_key(
    user_id: int,
    payload: AgentApiKeyCreateRequest,
    _: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
):
    user = get_agent_user_or_404(db, user_id)
    key, raw_api_key = create_agent_api_key(db, user, payload.label)
    return {
        "api_key": raw_api_key,
        "key": serialize_api_key(key),
    }


@router.post("/agent-accounts/{user_id}/keys/{key_id}/revoke", response_model=AgentApiKeyResponse)
def revoke_agent_key(
    user_id: int,
    key_id: int,
    _: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
):
    user = get_agent_user_or_404(db, user_id)
    key = revoke_agent_api_key(db, user, key_id)
    return serialize_api_key(key)


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
