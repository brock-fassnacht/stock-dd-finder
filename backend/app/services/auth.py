import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import AgentApiKey, AuthSession, User


PBKDF2_ITERATIONS = 390000
DEFAULT_MEMBER_POST_LIMIT = 1
DEFAULT_AGENT_POST_LIMIT = 10
ACCOUNT_TYPES = {"member", "agent"}
API_KEY_PREFIX = "tcak_"


def build_member_label(user_id: int) -> str:
    return f"Member {user_id}"


def normalize_account_type(account_type: str | None) -> str:
    normalized = (account_type or "member").strip().lower()
    return normalized if normalized in ACCOUNT_TYPES else "member"


def get_user_post_limit(user: User | None) -> int:
    if not user:
        return DEFAULT_MEMBER_POST_LIMIT

    fallback = (
        DEFAULT_AGENT_POST_LIMIT
        if normalize_account_type(user.account_type) == "agent"
        else DEFAULT_MEMBER_POST_LIMIT
    )

    try:
        configured_limit = int(user.monthly_post_limit_per_stance)
    except (TypeError, ValueError):
        configured_limit = fallback

    return configured_limit if configured_limit > 0 else fallback


def build_user_label(user: User) -> str:
    display_name = (user.display_name or "").strip()
    if display_name:
        return display_name

    if normalize_account_type(user.account_type) == "agent":
        return f"Agent {user.id}"

    return build_member_label(user.id)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "$".join([
        "pbkdf2_sha256",
        str(PBKDF2_ITERATIONS),
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    ])


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = encoded_hash.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    salt = base64.b64decode(salt_b64.encode("ascii"))
    expected_digest = base64.b64decode(digest_b64.encode("ascii"))
    calculated = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
    return hmac.compare_digest(calculated, expected_digest)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_api_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user: User) -> str:
    raw_token = secrets.token_urlsafe(32)
    session = AuthSession(user_id=user.id, token_hash=hash_session_token(raw_token))
    db.add(session)
    db.commit()
    return raw_token


def _touch_api_key(db: Session, api_key: AgentApiKey) -> None:
    api_key.last_used_at = datetime.now(timezone.utc)
    db.add(api_key)
    db.commit()


def create_agent_api_key(db: Session, user: User, label: str) -> tuple[AgentApiKey, str]:
    raw_key = f"{API_KEY_PREFIX}{secrets.token_urlsafe(32)}"
    api_key = AgentApiKey(
        user_id=user.id,
        label=label.strip(),
        key_hash=hash_api_key(raw_key),
        is_active=True,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return api_key, raw_key


def list_agent_api_keys(db: Session, user: User) -> list[AgentApiKey]:
    return db.query(AgentApiKey).filter(AgentApiKey.user_id == user.id).order_by(AgentApiKey.created_at.desc()).all()


def revoke_agent_api_key(db: Session, user: User, key_id: int) -> AgentApiKey:
    api_key = db.query(AgentApiKey).filter(AgentApiKey.user_id == user.id, AgentApiKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if not api_key.revoked_at:
        api_key.revoked_at = datetime.now(timezone.utc)
        api_key.is_active = False
        db.add(api_key)
        db.commit()
        db.refresh(api_key)

    return api_key


def get_user_from_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None

    session = db.query(AuthSession).filter(AuthSession.token_hash == hash_session_token(token)).first()
    if session:
        return session.user

    api_key = db.query(AgentApiKey).filter(
        AgentApiKey.key_hash == hash_api_key(token),
        AgentApiKey.is_active.is_(True),
        AgentApiKey.revoked_at.is_(None),
    ).first()
    if api_key:
        _touch_api_key(db, api_key)
        return api_key.user

    return None


def parse_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        return None
    return parts[1].strip()


def get_optional_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User | None:
    token = parse_bearer_token(authorization)
    return get_user_from_token(db, token)


def require_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    user = get_optional_current_user(db, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in to continue")
    return user


def require_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.admin_key or not x_admin_key or x_admin_key.strip() != settings.admin_key.strip():
        raise HTTPException(status_code=401, detail="Invalid admin key")
