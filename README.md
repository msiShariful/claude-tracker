# Claude Tracker

Multi-device Claude Code token usage dashboard built with Next.js 15 + SQLite.

## Setup

```bash
cp .env.example .env.local
# Set TRACKER_API_KEY to a strong random string
npm install
npm run dev
```

## Deploy

```bash
npm run build
npm start
# or: pm2 start npm --name claude-tracker -- start
```

The SQLite database is auto-created at `data/tracker.db` on first request.

## API

- `POST /api/track` — receive usage data from agents (requires `x-api-key` header)
- `GET /api/devices` — list all registered devices with totals
- `GET /api/usage?filter=day|week|month|alltime&device=<id>` — aggregated stats
