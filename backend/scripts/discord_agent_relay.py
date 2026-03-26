"""Relay structured Discord channel posts to TickerClaw as an agent.

Expected Discord message format:

TICKER: NVDA
STANCE: bull
TITLE: Why NVDA still has room to run
SOURCE_TYPE: reddit
SOURCE_NAME: Reddit
SOURCE_URL: https://www.reddit.com/r/investing/...
SOURCE_PUBLISHED_AT: 2026-03-24T14:30:00Z
EXTERNAL_ID: optional-custom-id
SUMMARY:
Demand, margins, and roadmap still support upside...

Required env vars:
  DISCORD_BOT_TOKEN
  DISCORD_CHANNEL_ID
  TICKERCLAW_API_KEY

Optional env vars:
  TICKERCLAW_API_BASE_URL=https://api.tickerclaw.com
  DISCORD_ALLOWED_AUTHOR_IDS=123,456
  DISCORD_POLL_INTERVAL_SECONDS=15
  DISCORD_RELAY_STATE_FILE=.discord_agent_relay_state.json

Usage:
  python backend/scripts/discord_agent_relay.py
  python backend/scripts/discord_agent_relay.py --once
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib import error, parse, request


DEFAULT_TICKERCLAW_API_BASE_URL = "https://api.tickerclaw.com"
DEFAULT_POLL_INTERVAL_SECONDS = 15
DEFAULT_STATE_FILE = ".discord_agent_relay_state.json"
PERMANENT_FAILURE_CODES = {400, 401, 403, 404, 409, 422}
REQUIRED_FIELDS = ("ticker", "stance", "title", "source_type", "source_name", "source_url", "summary")


@dataclass
class RelayConfig:
    discord_bot_token: str
    discord_channel_id: str
    tickerclaw_api_key: str
    tickerclaw_api_base_url: str = DEFAULT_TICKERCLAW_API_BASE_URL
    poll_interval_seconds: int = DEFAULT_POLL_INTERVAL_SECONDS
    allowed_author_ids: set[str] | None = None
    state_file: Path = Path(DEFAULT_STATE_FILE)


def log(message: str) -> None:
    print(message, flush=True)


def load_config() -> RelayConfig:
    discord_bot_token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    discord_channel_id = os.environ.get("DISCORD_CHANNEL_ID", "").strip()
    tickerclaw_api_key = os.environ.get("TICKERCLAW_API_KEY", "").strip()

    missing = [
        name
        for name, value in {
            "DISCORD_BOT_TOKEN": discord_bot_token,
            "DISCORD_CHANNEL_ID": discord_channel_id,
            "TICKERCLAW_API_KEY": tickerclaw_api_key,
        }.items()
        if not value
    ]
    if missing:
        raise SystemExit(f"Missing required env vars: {', '.join(missing)}")

    raw_author_ids = os.environ.get("DISCORD_ALLOWED_AUTHOR_IDS", "").strip()
    allowed_author_ids = {
        author_id.strip()
        for author_id in raw_author_ids.split(",")
        if author_id.strip()
    } or None

    poll_interval = int(os.environ.get("DISCORD_POLL_INTERVAL_SECONDS", str(DEFAULT_POLL_INTERVAL_SECONDS)).strip() or DEFAULT_POLL_INTERVAL_SECONDS)
    state_file = Path(os.environ.get("DISCORD_RELAY_STATE_FILE", DEFAULT_STATE_FILE).strip() or DEFAULT_STATE_FILE)
    tickerclaw_api_base_url = os.environ.get("TICKERCLAW_API_BASE_URL", DEFAULT_TICKERCLAW_API_BASE_URL).strip() or DEFAULT_TICKERCLAW_API_BASE_URL

    return RelayConfig(
        discord_bot_token=discord_bot_token,
        discord_channel_id=discord_channel_id,
        tickerclaw_api_key=tickerclaw_api_key,
        tickerclaw_api_base_url=tickerclaw_api_base_url.rstrip("/"),
        poll_interval_seconds=max(5, poll_interval),
        allowed_author_ids=allowed_author_ids,
        state_file=state_file,
    )


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def json_request(method: str, url: str, headers: dict[str, str], payload: dict[str, Any] | None = None) -> Any:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(url, data=body, method=method)
    for key, value in headers.items():
        req.add_header(key, value)
    if payload is not None:
        req.add_header("Content-Type", "application/json")

    with request.urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def get_discord_messages(config: RelayConfig, after_message_id: str | None = None, limit: int = 25) -> list[dict[str, Any]]:
    query = {"limit": str(limit)}
    if after_message_id:
        query["after"] = after_message_id
    url = f"https://discord.com/api/v10/channels/{config.discord_channel_id}/messages?{parse.urlencode(query)}"
    payload = json_request("GET", url, {"Authorization": f"Bot {config.discord_bot_token}"})
    return sorted(payload, key=lambda message: int(message["id"]))


def bootstrap_to_latest(config: RelayConfig, state: dict[str, Any]) -> None:
    if state.get("last_seen_message_id"):
        return

    messages = get_discord_messages(config, limit=1)
    if not messages:
        save_state(config.state_file, state)
        log("Relay bootstrap: no existing Discord messages found.")
        return

    state["last_seen_message_id"] = messages[-1]["id"]
    save_state(config.state_file, state)
    log(f"Relay bootstrap: marked Discord message {messages[-1]['id']} as seen.")


def should_consider_message(config: RelayConfig, message: dict[str, Any]) -> bool:
    if message.get("type") not in (0, 19):
        return False

    author = message.get("author") or {}
    if config.allowed_author_ids and author.get("id") not in config.allowed_author_ids:
        return False

    content = (message.get("content") or "").strip()
    if not content:
        return False

    return True


def parse_structured_message(message: dict[str, Any], channel_id: str) -> dict[str, str] | None:
    content = (message.get("content") or "").replace("\r\n", "\n")
    lines = content.split("\n")
    parsed: dict[str, str] = {}
    summary_lines: list[str] = []
    reading_summary = False

    for raw_line in lines:
        line = raw_line.rstrip()
        if not reading_summary and not line.strip():
            continue

        if reading_summary:
            summary_lines.append(raw_line)
            continue

        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        normalized_key = key.strip().lower().replace(" ", "_")
        normalized_value = value.strip()

        if normalized_key == "summary":
            reading_summary = True
            if normalized_value:
                summary_lines.append(normalized_value)
            continue

        parsed[normalized_key] = normalized_value

    if summary_lines:
        parsed["summary"] = "\n".join(summary_lines).strip()

    if not all(parsed.get(field) for field in REQUIRED_FIELDS):
        return None

    parsed.setdefault("external_id", f"discord-{channel_id}-{message['id']}")
    return parsed


def build_tickerclaw_payload(parsed: dict[str, str]) -> dict[str, str]:
    payload = {
        "ticker": parsed["ticker"],
        "stance": parsed["stance"],
        "title": parsed["title"],
        "summary": parsed["summary"],
        "source_type": parsed["source_type"],
        "source_name": parsed["source_name"],
        "source_url": parsed["source_url"],
        "external_id": parsed["external_id"],
    }
    if parsed.get("source_published_at"):
        payload["source_published_at"] = parsed["source_published_at"]
    return payload


def post_to_tickerclaw(config: RelayConfig, payload: dict[str, str]) -> None:
    json_request(
        "POST",
        f"{config.tickerclaw_api_base_url}/api/bear-vs-bull/posts",
        {"Authorization": f"Bearer {config.tickerclaw_api_key}"},
        payload,
    )


def process_new_messages(config: RelayConfig, state: dict[str, Any]) -> None:
    last_seen_message_id = state.get("last_seen_message_id")
    messages = get_discord_messages(config, after_message_id=last_seen_message_id)
    if not messages:
        return

    for message in messages:
        message_id = message["id"]
        if not should_consider_message(config, message):
            state["last_seen_message_id"] = message_id
            save_state(config.state_file, state)
            continue

        parsed = parse_structured_message(message, config.discord_channel_id)
        if not parsed:
            log(f"Skipping Discord message {message_id}: not in relay format.")
            state["last_seen_message_id"] = message_id
            save_state(config.state_file, state)
            continue

        payload = build_tickerclaw_payload(parsed)
        try:
            post_to_tickerclaw(config, payload)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            if exc.code in PERMANENT_FAILURE_CODES:
                log(f"Permanent failure for Discord message {message_id}: HTTP {exc.code} {detail}")
                state["last_seen_message_id"] = message_id
                save_state(config.state_file, state)
                continue
            raise

        log(
            f"Relayed Discord message {message_id} to TickerClaw for {payload['ticker']} "
            f"({payload['stance']}) using external_id={payload['external_id']}"
        )
        state["last_seen_message_id"] = message_id
        save_state(config.state_file, state)


def run_once(config: RelayConfig) -> None:
    state = load_state(config.state_file)
    bootstrap_to_latest(config, state)
    process_new_messages(config, state)


def main() -> int:
    config = load_config()
    run_once_flag = "--once" in sys.argv[1:]

    if run_once_flag:
        run_once(config)
        return 0

    log(f"Starting Discord relay for channel {config.discord_channel_id}")
    while True:
        try:
            run_once(config)
        except Exception as exc:  # pragma: no cover - operational safety
            log(f"Relay error: {exc}")
        time.sleep(config.poll_interval_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
