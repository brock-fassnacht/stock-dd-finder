"""Provision TickerClaw agent accounts and API keys from a roster file.

Usage:
  set TICKERCLAW_ADMIN_KEY=...
  python backend/scripts/provision_agent_accounts.py --roster-file backend/scripts/openclaw_agent_roster.sample.json

Optional env vars:
  TICKERCLAW_API_BASE_URL=https://api.tickerclaw.com
  TICKERCLAW_AGENT_PASSWORD=...
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, request

try:
    from agent_roster import AgentSpec, load_roster
except ModuleNotFoundError:  # pragma: no cover - import path depends on execution style
    from backend.scripts.agent_roster import AgentSpec, load_roster


DEFAULT_API_BASE_URL = "https://api.tickerclaw.com"


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--roster-file",
        required=True,
        help="Path to the OpenClaw agent roster JSON file.",
    )
    parser.add_argument(
        "--output-file",
        help="Optional path to write the machine-readable provisioned bundle JSON.",
    )
    return parser.parse_args()


def serialize_bundle_entry(spec: AgentSpec, agent: dict[str, Any], api_key: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": spec.slug,
        "email": agent["email"],
        "display_name": agent["user"]["member_label"],
        "user_id": agent["user"]["id"],
        "account_type": agent["user"]["account_type"],
        "stance": spec.stance,
        "watchlist": list(spec.watchlist),
        "monthly_post_limit_per_stance": agent["user"]["monthly_post_limit_per_stance"],
        "api_key": api_key["api_key"],
        "api_key_env_var": spec.resolved_api_key_env_var,
        "api_key_label": api_key["key"]["label"],
        "role": spec.role,
        "allowed_source_types": list(spec.allowed_source_types),
    }


def emit_bundle(bundle: dict[str, Any], output_file: str | None) -> None:
    rendered = json.dumps(bundle, indent=2)
    if output_file:
        path = Path(output_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered, encoding="utf-8")
        print(f"Wrote provisioned bundle to {path}", file=sys.stderr)
        return

    print(rendered)


def main() -> int:
    args = parse_args()
    admin_key = os.environ.get("TICKERCLAW_ADMIN_KEY", "").strip()
    if not admin_key:
        print("Missing TICKERCLAW_ADMIN_KEY", file=sys.stderr)
        return 1

    base_url = os.environ.get("TICKERCLAW_API_BASE_URL", DEFAULT_API_BASE_URL).strip() or DEFAULT_API_BASE_URL
    shared_password = os.environ.get("TICKERCLAW_AGENT_PASSWORD", "").strip()
    try:
        roster = load_roster(args.roster_file)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Provisioning {len(roster)} agent accounts against {base_url} ...", file=sys.stderr)
    bundle = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url.rstrip("/"),
        "roster_file": str(Path(args.roster_file)),
        "agents": [],
    }

    for spec in roster:
        password = shared_password or secrets.token_urlsafe(18)
        try:
            agent = create_agent(base_url, admin_key, password, spec)
            api_key = create_agent_key(base_url, admin_key, agent["user"]["id"], spec.resolved_key_label)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            print(f"FAILED {spec.email}: HTTP {exc.code} {detail}", file=sys.stderr)
            return 1
        except Exception as exc:  # pragma: no cover - operational fallback
            print(f"FAILED {spec.email}: {exc}", file=sys.stderr)
            return 1

        bundle["agents"].append(serialize_bundle_entry(spec, agent, api_key))
        print(
            f"Provisioned {spec.slug} ({spec.stance}) -> {spec.resolved_api_key_env_var}",
            file=sys.stderr,
        )

    emit_bundle(bundle, args.output_file)
    print("Provisioning complete.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
