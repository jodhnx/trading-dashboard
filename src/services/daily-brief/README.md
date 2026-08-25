# Daily Brief (Phase 9)

Assembles a **persisted** research brief for one user and one UTC date from:

- Market quotes / technical snapshots
- Trading Engine setups (Phase 7)
- Stored news
- Stored Phase 8 AI analyses
- Stored macro events (never invented)

## Rules

- Page load and `GET /api/daily-brief` **only read** the database.
- Generation is explicit: `POST /api/daily-brief/generate`.
- No cron in Phase 9.
- Entry / Stop / Target / Risk / Position Size come **only** from the Trading Engine.
- OpenAI may summarize; it cannot override engine numbers or invent data.
- Missing data → `DATA UNAVAILABLE` / `UNKNOWN` / empty lists — never fantasy fill.
- Duplicate `(user_id, brief_date)` → `BRIEF_EXISTS` (409).

## API

- `GET /api/daily-brief` — today’s brief (UTC)
- `GET /api/daily-brief?date=YYYY-MM-DD`
- `GET /api/daily-brief?history=1&limit=14`
- `POST /api/daily-brief/generate` — `{ "date"?: "YYYY-MM-DD" }`
