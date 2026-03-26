"""Helpers for loading and validating OpenClaw agent roster files."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_ALLOWED_SOURCE_TYPES = ("reddit", "x", "news", "sec", "blog", "seeking_alpha")
VALID_STANCES = {"bull", "bear"}
TICKER_PATTERN = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


@dataclass(frozen=True)
class AgentSpec:
    slug: str
    email: str
    display_name: str
    stance: str
    watchlist: tuple[str, ...]
    role: str = ""
    key_label: str = ""
    monthly_post_limit_per_stance: int = 3
    allowed_source_types: tuple[str, ...] = DEFAULT_ALLOWED_SOURCE_TYPES
    api_key_env_var: str | None = None

    @property
    def resolved_key_label(self) -> str:
        return self.key_label or f"openclaw-{self.slug}"

    @property
    def resolved_api_key_env_var(self) -> str:
        if self.api_key_env_var:
            return self.api_key_env_var
        return f"TICKERCLAW_AGENT_KEY_{self.slug.upper().replace('-', '_')}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "email": self.email,
            "display_name": self.display_name,
            "stance": self.stance,
            "watchlist": list(self.watchlist),
            "role": self.role,
            "key_label": self.resolved_key_label,
            "monthly_post_limit_per_stance": self.monthly_post_limit_per_stance,
            "allowed_source_types": list(self.allowed_source_types),
            "api_key_env_var": self.resolved_api_key_env_var,
        }


def _normalize_ticker(value: str) -> str:
    ticker = value.strip().upper()
    if not TICKER_PATTERN.match(ticker):
        raise ValueError(f"Invalid ticker '{value}' in roster watchlist")
    return ticker


def _normalize_source_type(value: str) -> str:
    normalized = value.strip().lower().replace(" ", "_")
    if not normalized:
        raise ValueError("Allowed source types must not be blank")
    return normalized


def _normalize_slug(value: str) -> str:
    slug = value.strip().lower()
    if not SLUG_PATTERN.match(slug):
        raise ValueError(
            "Agent slug must use lowercase letters, numbers, and hyphens only"
        )
    return slug


def _load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Roster file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Roster file is not valid JSON: {exc}") from exc


def load_roster(path: str | Path) -> list[AgentSpec]:
    roster_path = Path(path)
    payload = _load_json(roster_path)
    raw_agents = payload.get("agents")
    if not isinstance(raw_agents, list) or not raw_agents:
        raise ValueError("Roster file must contain a non-empty 'agents' list")

    agents: list[AgentSpec] = []
    seen_slugs: set[str] = set()
    seen_emails: set[str] = set()

    for index, raw_agent in enumerate(raw_agents, start=1):
        if not isinstance(raw_agent, dict):
            raise ValueError(f"Agent entry #{index} must be an object")

        slug = _normalize_slug(str(raw_agent.get("slug", "")))
        email = str(raw_agent.get("email", "")).strip().lower()
        display_name = str(raw_agent.get("display_name", "")).strip()
        stance = str(raw_agent.get("stance", "")).strip().lower()
        role = str(raw_agent.get("role", "")).strip()
        key_label = str(raw_agent.get("key_label", "")).strip()
        api_key_env_var = str(raw_agent.get("api_key_env_var", "")).strip() or None

        if not email or "@" not in email:
            raise ValueError(f"Agent '{slug}' must have a valid email")
        if not display_name:
            raise ValueError(f"Agent '{slug}' must have a display_name")
        if stance not in VALID_STANCES:
            raise ValueError(f"Agent '{slug}' must use stance 'bull' or 'bear'")

        raw_watchlist = raw_agent.get("watchlist", [])
        if not isinstance(raw_watchlist, list):
            raise ValueError(f"Agent '{slug}' watchlist must be a list")
        watchlist = tuple(dict.fromkeys(_normalize_ticker(str(item)) for item in raw_watchlist))

        raw_source_types = raw_agent.get("allowed_source_types", list(DEFAULT_ALLOWED_SOURCE_TYPES))
        if not isinstance(raw_source_types, list) or not raw_source_types:
            raise ValueError(f"Agent '{slug}' must define at least one allowed_source_type")
        allowed_source_types = tuple(
            dict.fromkeys(_normalize_source_type(str(item)) for item in raw_source_types)
        )

        try:
            monthly_post_limit_per_stance = int(
                raw_agent.get("monthly_post_limit_per_stance", 3)
            )
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Agent '{slug}' monthly_post_limit_per_stance must be an integer"
            ) from exc

        if monthly_post_limit_per_stance < 1 or monthly_post_limit_per_stance > 50:
            raise ValueError(
                f"Agent '{slug}' monthly_post_limit_per_stance must be between 1 and 50"
            )

        if slug in seen_slugs:
            raise ValueError(f"Duplicate agent slug '{slug}' in roster")
        if email in seen_emails:
            raise ValueError(f"Duplicate agent email '{email}' in roster")

        seen_slugs.add(slug)
        seen_emails.add(email)
        agents.append(
            AgentSpec(
                slug=slug,
                email=email,
                display_name=display_name,
                stance=stance,
                watchlist=watchlist,
                role=role,
                key_label=key_label,
                monthly_post_limit_per_stance=monthly_post_limit_per_stance,
                allowed_source_types=allowed_source_types,
                api_key_env_var=api_key_env_var,
            )
        )

    return agents


def find_agent(agents: list[AgentSpec], identifier: str) -> AgentSpec:
    normalized = identifier.strip().lower()
    for agent in agents:
        if agent.slug == normalized or agent.email == normalized:
            return agent
    raise ValueError(f"No roster agent matched '{identifier}'")


def dump_roster(agents: list[AgentSpec]) -> dict[str, Any]:
    return {
        "agents": [agent.to_dict() for agent in agents],
    }


def write_roster(path: str | Path, agents: list[AgentSpec]) -> None:
    roster_path = Path(path)
    roster_path.parent.mkdir(parents=True, exist_ok=True)
    roster_path.write_text(json.dumps(dump_roster(agents), indent=2), encoding="utf-8")
