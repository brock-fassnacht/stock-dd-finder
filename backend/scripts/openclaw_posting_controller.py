"""Assign, validate, and publish OpenClaw Bear vs Bull posts to TickerClaw.

This script is intended to run on the Hetzner box beside OpenClaw. It does not
call OpenClaw directly; instead it gives you two clean integration points:

1. `list-jobs` / `build-prompt` to assign an agent a stock + stance + JSON-only task
2. `publish` to validate the resulting candidate JSON and optionally post it

Required environment variables for live publishing:
  TICKERCLAW_AGENT_KEY_<AGENT_SLUG>

Optional environment variables:
  TICKERCLAW_API_BASE_URL=https://api.tickerclaw.com
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request

try:
    from agent_roster import AgentSpec, find_agent, load_roster, write_roster
except ModuleNotFoundError:  # pragma: no cover - import path depends on execution style
    from backend.scripts.agent_roster import AgentSpec, find_agent, load_roster, write_roster


DEFAULT_TICKERCLAW_API_BASE_URL = "https://api.tickerclaw.com"
DEFAULT_STATE_FILE = ".openclaw_posting_controller_state.json"
TITLE_MAX_LENGTH = 120
TITLE_MIN_LENGTH = 5
SUMMARY_MIN_LENGTH = 20
SUMMARY_MAX_LENGTH = 1700


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def json_request(
    method: str,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any] | None = None,
) -> Any:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(url, data=body, method=method)
    for key, value in headers.items():
        req.add_header(key, value)
    if payload is not None:
        req.add_header("Content-Type", "application/json")

    with request.urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def load_config(state_file: str | None) -> tuple[str, Path]:
    api_base_url = (
        os.environ.get("TICKERCLAW_API_BASE_URL", DEFAULT_TICKERCLAW_API_BASE_URL).strip()
        or DEFAULT_TICKERCLAW_API_BASE_URL
    )
    return api_base_url.rstrip("/"), Path(state_file or DEFAULT_STATE_FILE)


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"disabled_agents": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            return {"disabled_agents": {}}
        payload.setdefault("disabled_agents", {})
        return payload
    except Exception:
        return {"disabled_agents": {}}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def disable_agent(state: dict[str, Any], state_file: Path, spec: AgentSpec, reason: str) -> None:
    disabled_agents = state.setdefault("disabled_agents", {})
    disabled_agents[spec.slug] = {
        "reason": reason,
        "disabled_at": datetime.now(timezone.utc).isoformat(),
    }
    save_state(state_file, state)


def enable_agent(state: dict[str, Any], state_file: Path, spec: AgentSpec) -> None:
    disabled_agents = state.setdefault("disabled_agents", {})
    if spec.slug in disabled_agents:
        disabled_agents.pop(spec.slug, None)
        save_state(state_file, state)


def is_agent_disabled(state: dict[str, Any], spec: AgentSpec) -> dict[str, Any] | None:
    return state.get("disabled_agents", {}).get(spec.slug)


def fetch_tracked_companies(api_base_url: str) -> dict[str, dict[str, Any]]:
    companies = json_request("GET", f"{api_base_url}/api/companies", {})
    return {
        str(company["ticker"]).strip().upper(): company
        for company in companies
        if isinstance(company, dict) and company.get("ticker")
    }


def build_job(spec: AgentSpec, ticker: str, company_name: str) -> dict[str, Any]:
    return {
        "agent_slug": spec.slug,
        "agent_email": spec.email,
        "display_name": spec.display_name,
        "ticker": ticker,
        "company_name": company_name,
        "stance": spec.stance,
        "allowed_source_types": list(spec.allowed_source_types),
        "title_max": TITLE_MAX_LENGTH,
        "summary_min": SUMMARY_MIN_LENGTH,
        "summary_max": SUMMARY_MAX_LENGTH,
        "must_include_source_metadata": True,
    }


def build_prompt(spec: AgentSpec, job: dict[str, Any]) -> str:
    source_types = ", ".join(job["allowed_source_types"])
    role_line = f"Agent role: {spec.role}" if spec.role else "Agent role: Follow the assigned stance."
    schema = {
        "ticker": job["ticker"],
        "stance": job["stance"],
        "title": "string",
        "summary": "string",
        "source_type": "one of the allowed_source_types",
        "source_name": "string",
        "source_url": "https://example.com/source",
        "source_published_at": "YYYY-MM-DD or omit",
        "external_id": "leave blank or omit; controller will overwrite deterministically",
    }
    return (
        f"You are {spec.display_name}. {role_line}\n"
        f"Produce one {job['stance']} thesis for {job['ticker']} ({job['company_name']}).\n"
        f"Only use source types from: {source_types}.\n"
        "Respond with JSON only. No markdown, no prose, no code fences.\n"
        f"Constraints: title {TITLE_MIN_LENGTH}-{TITLE_MAX_LENGTH} chars, summary "
        f"{SUMMARY_MIN_LENGTH}-{SUMMARY_MAX_LENGTH} chars, source metadata required.\n"
        "Keep the argument evidence-based and specific to the supplied ticker.\n"
        f"JSON shape:\n{json.dumps(schema, indent=2)}"
    )


def normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("Expected a string field in candidate payload")
    normalized = value.strip()
    if not normalized:
        raise ValueError("String fields must not be blank")
    return normalized


def normalize_source_type(value: Any, allowed_source_types: tuple[str, ...]) -> str:
    normalized = normalize_text(value).lower().replace(" ", "_")
    if normalized not in allowed_source_types:
        raise ValueError(
            f"source_type '{normalized}' is not allowed for this agent. Allowed: {', '.join(allowed_source_types)}"
        )
    return normalized


def normalize_url(value: Any) -> str:
    normalized = normalize_text(value)
    parsed_url = parse.urlparse(normalized)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("source_url must be an absolute http(s) URL")
    return normalized


def normalize_date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    normalized = normalize_text(value)
    try:
        return date.fromisoformat(normalized).isoformat()
    except ValueError as exc:
        raise ValueError("source_published_at must be YYYY-MM-DD") from exc


def deterministic_external_id(spec: AgentSpec, payload: dict[str, Any]) -> str:
    source_url = payload["source_url"].strip().lower()
    digest = hashlib.sha256(
        f"{spec.slug}|{payload['ticker']}|{payload['stance']}|{source_url}".encode("utf-8")
    ).hexdigest()[:16]
    return f"openclaw-{spec.slug}-{payload['ticker'].lower()}-{payload['stance']}-{digest}"


def validate_candidate(
    spec: AgentSpec,
    tracked_companies: dict[str, dict[str, Any]],
    raw_candidate: dict[str, Any],
    ticker_hint: str | None = None,
) -> dict[str, Any]:
    ticker = normalize_text(raw_candidate.get("ticker", "")).upper()
    stance = normalize_text(raw_candidate.get("stance", "")).lower()
    title = normalize_text(raw_candidate.get("title", ""))
    summary = normalize_text(raw_candidate.get("summary", ""))
    source_type = normalize_source_type(raw_candidate.get("source_type", ""), spec.allowed_source_types)
    source_name = normalize_text(raw_candidate.get("source_name", ""))
    source_url = normalize_url(raw_candidate.get("source_url", ""))
    source_published_at = normalize_date(raw_candidate.get("source_published_at"))

    if ticker_hint and ticker != ticker_hint:
        raise ValueError(f"Candidate ticker '{ticker}' did not match the assigned ticker '{ticker_hint}'")
    if ticker not in tracked_companies:
        raise ValueError(f"Ticker '{ticker}' is not in the tracked TickerClaw company list")
    if ticker not in spec.watchlist:
        raise ValueError(f"Ticker '{ticker}' is not in agent '{spec.slug}' watchlist")
    if stance != spec.stance:
        raise ValueError(
            f"Candidate stance '{stance}' does not match agent '{spec.slug}' stance '{spec.stance}'"
        )
    if len(title) < TITLE_MIN_LENGTH or len(title) > TITLE_MAX_LENGTH:
        raise ValueError(f"title must be between {TITLE_MIN_LENGTH} and {TITLE_MAX_LENGTH} characters")
    if len(summary) < SUMMARY_MIN_LENGTH or len(summary) > SUMMARY_MAX_LENGTH:
        raise ValueError(f"summary must be between {SUMMARY_MIN_LENGTH} and {SUMMARY_MAX_LENGTH} characters")

    payload = {
        "ticker": ticker,
        "stance": stance,
        "title": title,
        "summary": summary,
        "source_type": source_type,
        "source_name": source_name,
        "source_url": source_url,
    }
    if source_published_at:
        payload["source_published_at"] = source_published_at
    payload["external_id"] = deterministic_external_id(spec, payload)
    return payload


def resolve_candidate_input(candidate_file: str | None, candidate_json: str | None) -> dict[str, Any]:
    if candidate_file:
        raw = Path(candidate_file).read_text(encoding="utf-8")
    else:
        raw = candidate_json or ""

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Candidate payload is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError("Candidate payload must be a JSON object")
    return payload


def list_jobs(args: argparse.Namespace) -> int:
    api_base_url, state_file = load_config(args.state_file)
    state = load_state(state_file)
    agents = load_roster(args.roster_file)
    tracked_companies = fetch_tracked_companies(api_base_url)

    filtered_agents = agents
    if args.agent:
        filtered_agents = [find_agent(agents, args.agent)]

    jobs: list[dict[str, Any]] = []
    for spec in filtered_agents:
        disabled = is_agent_disabled(state, spec)
        if disabled and not args.include_disabled:
            continue

        for ticker in spec.watchlist:
            company = tracked_companies.get(ticker)
            if not company:
                continue
            job = build_job(spec, ticker, str(company.get("name", ticker)))
            if disabled:
                job["disabled"] = disabled
            jobs.append(job)

    print(json.dumps({"generated_at": datetime.now(timezone.utc).isoformat(), "jobs": jobs}, indent=2))
    return 0


def build_prompt_command(args: argparse.Namespace) -> int:
    api_base_url, state_file = load_config(args.state_file)
    state = load_state(state_file)
    agents = load_roster(args.roster_file)
    spec = find_agent(agents, args.agent)
    disabled = is_agent_disabled(state, spec)
    if disabled:
        raise SystemExit(
            f"Agent '{spec.slug}' is disabled: {disabled.get('reason', 'unknown reason')}"
        )

    tracked_companies = fetch_tracked_companies(api_base_url)
    ticker = args.ticker.strip().upper()
    if ticker not in tracked_companies:
        raise SystemExit(f"Ticker '{ticker}' is not in the tracked TickerClaw company list")
    if ticker not in spec.watchlist:
        raise SystemExit(f"Ticker '{ticker}' is not in the watchlist for agent '{spec.slug}'")

    job = build_job(spec, ticker, str(tracked_companies[ticker].get("name", ticker)))
    print(build_prompt(spec, job))
    return 0


def publish_command(args: argparse.Namespace) -> int:
    api_base_url, state_file = load_config(args.state_file)
    state = load_state(state_file)
    agents = load_roster(args.roster_file)
    spec = find_agent(agents, args.agent)

    disabled = is_agent_disabled(state, spec)
    if disabled:
        raise SystemExit(
            f"Agent '{spec.slug}' is disabled: {disabled.get('reason', 'unknown reason')}"
        )

    tracked_companies = fetch_tracked_companies(api_base_url)
    candidate = resolve_candidate_input(args.candidate_file, args.candidate_json)
    ticker_hint = args.ticker.strip().upper() if args.ticker else None
    payload = validate_candidate(spec, tracked_companies, candidate, ticker_hint=ticker_hint)

    if args.dry_run:
        print(json.dumps({"mode": "dry-run", "payload": payload}, indent=2))
        return 0

    api_key = os.environ.get(spec.resolved_api_key_env_var, "").strip()
    if not api_key:
        raise SystemExit(
            f"Missing agent API key env var '{spec.resolved_api_key_env_var}' for agent '{spec.slug}'"
        )

    try:
        response = json_request(
            "POST",
            f"{api_base_url}/api/bear-vs-bull/posts",
            {"Authorization": f"Bearer {api_key}"},
            payload,
        )
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        if exc.code in {401, 403}:
            disable_agent(
                state,
                state_file,
                spec,
                f"HTTP {exc.code} while publishing. Rotate/reissue {spec.resolved_api_key_env_var}.",
            )
        result = {
            "status": "error",
            "http_status": exc.code,
            "agent_slug": spec.slug,
            "payload": payload,
            "detail": detail,
        }
        print(json.dumps(result, indent=2))
        return 1

    log(
        f"Published {payload['ticker']} {payload['stance']} post as {spec.slug} "
        f"with external_id={payload['external_id']}"
    )
    print(json.dumps({"status": "published", "agent_slug": spec.slug, "response": response}, indent=2))
    return 0


def enable_agent_command(args: argparse.Namespace) -> int:
    _, state_file = load_config(args.state_file)
    state = load_state(state_file)
    agents = load_roster(args.roster_file)
    spec = find_agent(agents, args.agent)
    enable_agent(state, state_file, spec)
    print(
        json.dumps(
            {
                "status": "enabled",
                "agent_slug": spec.slug,
                "api_key_env_var": spec.resolved_api_key_env_var,
            },
            indent=2,
        )
    )
    return 0


def assign_watchlists_command(args: argparse.Namespace) -> int:
    api_base_url, _ = load_config(args.state_file)
    agents = load_roster(args.roster_file)
    if args.limit < 1:
        raise ValueError("--limit must be at least 1")
    tracked_companies = fetch_tracked_companies(api_base_url)
    top_tickers = list(tracked_companies.keys())[: args.limit]
    if not top_tickers:
        raise ValueError("No tracked companies were returned by TickerClaw")

    bull_agents = [agent for agent in agents if agent.stance == "bull"]
    bear_agents = [agent for agent in agents if agent.stance == "bear"]
    if not bull_agents or not bear_agents:
        raise ValueError("Roster must include at least one bull agent and one bear agent")

    def assign_for_stance(group: list[AgentSpec]) -> dict[str, tuple[str, ...]]:
        assigned: dict[str, list[str]] = {agent.slug: [] for agent in group}
        for index, ticker in enumerate(top_tickers):
            owner = group[index % len(group)]
            assigned[owner.slug].append(ticker)
        return {slug: tuple(tickers) for slug, tickers in assigned.items()}

    bull_assignments = assign_for_stance(bull_agents)
    bear_assignments = assign_for_stance(bear_agents)

    updated_agents: list[AgentSpec] = []
    for agent in agents:
        if agent.stance == "bull":
            watchlist = bull_assignments[agent.slug]
        else:
            watchlist = bear_assignments[agent.slug]
        updated_agents.append(
            AgentSpec(
                slug=agent.slug,
                email=agent.email,
                display_name=agent.display_name,
                stance=agent.stance,
                watchlist=watchlist,
                role=agent.role,
                key_label=agent.key_label,
                monthly_post_limit_per_stance=agent.monthly_post_limit_per_stance,
                allowed_source_types=agent.allowed_source_types,
                api_key_env_var=agent.api_key_env_var,
            )
        )

    output_path = args.output_file or args.roster_file
    write_roster(output_path, updated_agents)
    print(
        json.dumps(
            {
                "status": "assigned",
                "output_file": str(Path(output_path)),
                "source_page": "https://www.tickerclaw.com/top-25",
                "source_api": f"{api_base_url}/api/companies",
                "tracked_ticker_count": len(top_tickers),
                "bull_agents": {agent.slug: list(bull_assignments[agent.slug]) for agent in bull_agents},
                "bear_agents": {agent.slug: list(bear_assignments[agent.slug]) for agent in bear_agents},
            },
            indent=2,
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roster-file", required=True, help="Path to the roster JSON file.")
    parser.add_argument(
        "--state-file",
        help="Optional path to the controller state file used for disabled agents.",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    assign_parser = subparsers.add_parser(
        "assign-watchlists",
        help="Populate roster watchlists from the current tracked companies shown on /top-25.",
    )
    assign_parser.add_argument(
        "--limit",
        type=int,
        default=25,
        help="How many tracked tickers to assign from the live tracked list.",
    )
    assign_parser.add_argument(
        "--output-file",
        help="Optional output file path. Defaults to overwriting --roster-file.",
    )

    jobs_parser = subparsers.add_parser("list-jobs", help="List all valid tracked jobs for the roster.")
    jobs_parser.add_argument("--agent", help="Optional agent slug or email to filter to.")
    jobs_parser.add_argument(
        "--include-disabled",
        action="store_true",
        help="Include jobs owned by disabled agents in the output.",
    )

    prompt_parser = subparsers.add_parser("build-prompt", help="Build a JSON-only OpenClaw prompt.")
    prompt_parser.add_argument("--agent", required=True, help="Agent slug or email.")
    prompt_parser.add_argument("--ticker", required=True, help="Tracked ticker to assign.")

    publish_parser = subparsers.add_parser("publish", help="Validate and optionally publish a candidate JSON payload.")
    publish_parser.add_argument("--agent", required=True, help="Agent slug or email.")
    publish_parser.add_argument("--ticker", help="Optional assigned ticker to enforce during validation.")
    publish_group = publish_parser.add_mutually_exclusive_group(required=True)
    publish_group.add_argument("--candidate-file", help="Path to a JSON file emitted by OpenClaw.")
    publish_group.add_argument("--candidate-json", help="Inline JSON emitted by OpenClaw.")
    publish_parser.add_argument("--dry-run", action="store_true", help="Validate and print the final payload without posting.")

    enable_parser = subparsers.add_parser("enable-agent", help="Re-enable an agent after key rotation.")
    enable_parser.add_argument("--agent", required=True, help="Agent slug or email.")

    return parser


def main() -> int:
    parser = build_parser()
    try:
        args = parser.parse_args()

        if args.command == "list-jobs":
            return list_jobs(args)
        if args.command == "assign-watchlists":
            return assign_watchlists_command(args)
        if args.command == "build-prompt":
            return build_prompt_command(args)
        if args.command == "publish":
            return publish_command(args)
        if args.command == "enable-agent":
            return enable_agent_command(args)

        parser.error(f"Unsupported command: {args.command}")
        return 2
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
