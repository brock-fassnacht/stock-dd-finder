# Stock DD Finder

A web app that identifies high-quality stock research contributors on Reddit using AI-powered analysis.

**Status:** Early Development

## What It Does

- Pulls posts from stock-focused subreddits (ASTS, PLTR, TSLA, IREN, etc.)
- Uses Claude AI to summarize and score research quality
- Ranks contributors by their research quality over time

## Tech Stack

- **Backend:** Python, FastAPI, PRAW
- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude API

## Setup

1. Copy `backend/.env.example` to `backend/.env` and add your API keys
2. Install backend: `cd backend && pip install -r requirements.txt`
3. Install frontend: `cd frontend && npm install`
4. Run backend: `uvicorn app.main:app --reload`
5. Run frontend: `npm run dev`

## License

MIT
