# Stock DD Finder

> **Early Development** - This project is under active development.

A web application that identifies high-quality stock research contributors on Reddit by analyzing posts from specific stock subreddits using Claude AI.

## Overview

Stock DD Finder helps investors discover quality due diligence (DD) research by:

- **Backend API Service** (Python + FastAPI) for Reddit data collection via PRAW
- **AI-Powered Sentiment Analysis** using Anthropic's Claude API
- **Contributor Ranking Algorithm** and data processing
- **Frontend Dashboard** (React with Vite + TypeScript) for stock trends and creator discovery
- **Cloud Database** (Supabase/PostgreSQL) for historical tracking

Built with proper Reddit API authentication and rate limit respect.

## Features

- **Reddit Integration**: Fetches posts from tracked subreddits (AST SpaceMobile, Palantir, Tesla, IREN, etc.)
- **AI-Powered Analysis**: Uses Claude to summarize posts and score research quality
- **Quality Scoring**: Evaluates posts on 4 dimensions:
  - Methodology (analytical rigor)
  - Sources (data backing)
  - Reasoning (logical coherence)
  - Objectivity (acknowledges risks)
- **Author Leaderboard**: Ranks contributors by their research quality over time
- **Post Browser**: Filter and sort posts by subreddit, date, and quality score

## Tech Stack

- **Backend**: Python + FastAPI + PRAW
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Database**: PostgreSQL (Supabase)
- **AI**: Anthropic Claude API
- **Reddit**: PRAW (Python Reddit API Wrapper) with rate limiting compliance

## Setup

### 1. Get API Credentials

#### Reddit API
1. Go to https://www.reddit.com/prefs/apps
2. Click "create another app..."
3. Choose "script" as the app type
4. Name it anything (e.g., "stock-research-analyzer")
5. Set redirect URI to `http://localhost:8000`
6. Copy the **client ID** (under the app name) and **secret**

#### Anthropic API
1. Go to https://console.anthropic.com/
2. Create an account or sign in
3. Go to API Keys and create a new key
4. Copy the key (starts with `sk-ant-`)

#### Supabase Database
1. Go to https://supabase.com/ and create a free account
2. Create a new project (choose a region close to you)
3. Wait for it to spin up
4. Go to Project Settings → Database
5. Copy the "Connection string" (URI format)
6. Replace `[YOUR-PASSWORD]` with your database password

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env file and fill in your credentials
cp .env.example .env
# Edit .env with your actual credentials

# Run the server
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000 with docs at http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

The frontend will be available at http://localhost:5173

## Usage

1. **Add Subreddits**: From the dashboard, add the subreddits you want to track
2. **Fetch Posts**: Click "Fetch & Analyze Posts" to pull recent posts and analyze them
3. **View Results**:
   - Browse the Leaderboard to see top contributors
   - View Posts to browse all analyzed content
   - Click on an author to see their post history and scores

## Target Subreddits

Pre-configured for:
- r/ASTSpaceMobile (AST SpaceMobile - ASTS)
- r/PLTR (Palantir - PLTR)
- r/teslainvestorsclub (Tesla - TSLA)
- r/IREN (Iren Inc - IREN)

## API Endpoints

### Authors
- `GET /api/authors` - List authors ranked by average score
- `GET /api/authors/{username}` - Get author details + their posts

### Posts
- `GET /api/posts` - List posts with filters (subreddit, date, score)
- `GET /api/posts/{id}` - Get post with analysis

### Subreddits
- `GET /api/subreddits` - List tracked subreddits
- `POST /api/subreddits` - Add new subreddit to track

### Admin
- `POST /api/admin/fetch` - Trigger manual fetch
- `GET /api/admin/stats` - Dashboard stats

## Quality Scoring Rubric

Posts are scored on 4 dimensions (1-10 each):

1. **Methodology** - Sound analytical methods (DCF, comparables, technical analysis)
2. **Sources** - Claims backed by data, filings, credible sources
3. **Reasoning** - Coherent logic, conclusions supported by evidence
4. **Objectivity** - Acknowledges risks and counterarguments

**Overall Score** = weighted average × 10 (scaled to 1-100)
- Methodology: 30%
- Reasoning: 30%
- Sources: 20%
- Objectivity: 20%

## Development

### Running Migrations

```bash
cd backend
alembic upgrade head
```

### Creating a Migration

```bash
cd backend
alembic revision --autogenerate -m "description"
```

## Data Handling & Rate Limiting

This application respects Reddit's API terms of service:

- **Rate Limiting**: PRAW automatically handles Reddit's rate limits (60 requests/minute for OAuth)
- **User Agent**: Properly identifies the application per Reddit API guidelines
- **Data Storage**: Only stores post metadata and analysis results; does not cache raw Reddit content indefinitely
- **Claude API**: Implements request throttling to stay within Anthropic rate limits

## License

MIT

## Repository

[github.com/brock-fassnacht/stock-dd-finder](https://github.com/brock-fassnacht/stock-dd-finder)
