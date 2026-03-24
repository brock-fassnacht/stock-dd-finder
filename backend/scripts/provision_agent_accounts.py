"""Provision the default TickerClaw agent accounts and API keys via the admin API.

Usage:
  set TICKERCLAW_ADMIN_KEY=...
  python backend/scripts/provision_agent_accounts.py

Optional env vars:
  TICKERCLAW_API_BASE_URL=https://api.tickerclaw.com
  TICKERCLAW_AGENT_PASSWORD=...
"""

from __future__ import annotations

import json
import os
import secrets
import sys
from dataclasses import dataclass
from typing import Any
from urllib import error, request


DEFAULT_API_BASE_URL = "https://api.tickerclaw.com"
DEFAULT_POST_LIMIT = 10


@dataclass(frozen=True)
class AgentSpec:
    email: str
    display_name: str
    role: str
    key_label: str
    monthly_post_limit_per_stance: int = DEFAULT_POST_LIMIT


DEFAULT_AGENTS = [
    AgentSpec(
        email="bull-scout@agents.tickerclaw.com",
        display_name="Bull Scout",
        role="Prioritizes upside catalysts, improving fundamentals, and supportive outside sentiment.",
        key_label="discord-bull-scout",
    ),
    AgentSpec(
        email="bear-scout@agents.tickerclaw.com",
        display_name="Bear Scout",
        role="Prioritizes downside catalysts, valuation risk, and skeptical outside sentiment.",
        key_label="discord-bear-scout",
    ),
    AgentSpec(
        email="catalyst-scout@agents.tickerclaw.com",
        display_name="Catalyst Scout",
        role="Looks for event-driven or contrarian setups and can post on either side when evidence is strongest.",
        key_label="discord-catalyst-scout",
    ),
]


def request_json(url: str, method: str, payload: dict[str, Any] | None, headers: dict[str, str]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    for key, value in headers.items():
        req.add_header(key, value)

    with request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def create_agent(base_url: str, admin_key: str, password: str, spec: AgentSpec) -> dict[str, Any]:
    payload = {
        "email": spec.email,
        "password": password,
        "display_name": spec.display_name,
        "monthly_post_limit_per_stance": spec.monthly_post_limit_per_stance,
    }
    return request_json(
        f"{base_url.rstrip('/')}/api/auth/agent-accounts",
        "POST",
        payload,
        {"X-Admin-Key": admin_key},
    )


def create_agent_key(base_url: str, admin_key: str, user_id: int, label: str) -> dict[str, Any]:
    return request_json(
        f"{base_url.rstrip('/')}/api/auth/agent-accounts/{user_id}/keys",
        "POST",
        {"label": label},
        {"X-Admin-Key": admin_key},
    )


def main() -> int:
    admin_key = os.environ.get("TICKERCLAW_ADMIN_KEY", "").strip()
    if not admin_key:
        print("Missing TICKERCLAW_ADMIN_KEY", file=sys.stderr)
        return 1

    base_url = os.environ.get("TICKERCLAW_API_BASE_URL", DEFAULT_API_BASE_URL).strip() or DEFAULT_API_BASE_URL
    shared_password = os.environ.get("TICKERCLAW_AGENT_PASSWORD", "").strip()

    print(f"Provisioning {len(DEFAULT_AGENTS)} agent accounts against {base_url} ...")
    for spec in DEFAULT_AGENTS:
        password = shared_password or secrets.token_urlsafe(18)
        try:
            agent = create_agent(base_url, admin_key, password, spec)
            api_key = create_agent_key(base_url, admin_key, agent["user"]["id"], spec.key_label)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            print(f"FAILED {spec.email}: HTTP {exc.code} {detail}", file=sys.stderr)
            return 1
        except Exception as exc:  # pragma: no cover - operational fallback
            print(f"FAILED {spec.email}: {exc}", file=sys.stderr)
            return 1

        print(json.dumps({
            "email": agent["email"],
            "display_name": agent["user"]["member_label"],
            "account_type": agent["user"]["account_type"],
            "monthly_post_limit_per_stance": agent["user"]["monthly_post_limit_per_stance"],
            "password": agent["password"],
            "session_token": agent["token"],
            "api_key": api_key["api_key"],
            "api_key_label": api_key["key"]["label"],
            "role": spec.role,
        }))

    print("Provisioning complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
