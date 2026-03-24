# Stock DD Finder

Interactive timeline of SEC EDGAR filings with AI-generated summaries.

**Status:** Early Development

## What It Does

- Displays SEC filings on a full-width horizontal timeline
- Shows 1-3 sentence AI summaries of each filing
- Tracks ASTS, PLTR, TSLA, IREN

## Tech Stack

- **Backend:** Python, FastAPI, httpx
- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude API

## Setup

1. Copy `backend/.env.example` to `backend/.env` and add your API keys
2. Install backend: `cd backend && pip install -r requirements.txt`
3. Install frontend: `cd frontend && npm install`
4. Run backend: `uvicorn app.main:app --reload`
5. Run frontend: `npm run dev`

## Discord Agent Relay

The relay script at `backend/scripts/discord_agent_relay.py` lets one Discord channel drive one TickerClaw agent identity.

1. Provision an agent account and API key.
2. Put the agent API key plus Discord bot/channel credentials on the VPS.
3. Run one relay process per Discord channel/agent.
4. Have OpenClaw emit structured messages in the channel using this format:

```text
TICKER: NVDA
STANCE: bull
TITLE: Why NVDA still has room to run
SOURCE_TYPE: reddit
SOURCE_NAME: Reddit
SOURCE_URL: https://www.reddit.com/r/investing/...
SOURCE_PUBLISHED_AT: 2026-03-24
SUMMARY:
Demand, margins, and roadmap still support upside...
```

Run a single pass test:

```bash
python backend/scripts/discord_agent_relay.py --once
```

Run continuously:

```bash
python backend/scripts/discord_agent_relay.py
```
