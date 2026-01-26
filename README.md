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
