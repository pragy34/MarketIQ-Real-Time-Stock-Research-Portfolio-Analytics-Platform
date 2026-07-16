# MarketLens

Live equity research terminal: stock screening, peer comparison, relative
valuation, movers/heatmap, NSE indices (incl. India VIX), watchlist, and
portfolio tracking — FastAPI + yfinance backend, vanilla JS frontend with a
classic finance-terminal aesthetic (near-black, amber accent, IBM Plex Mono).

```
Yahoo Finance (yfinance)
        │
        ▼
FastAPI backend (Python)
  ├── downloader.py     live fetch + JSON cache (5 min TTL) + seed fallback
  ├── transform.py      normalizes yfinance field names
  ├── sectors.py        sector averages / peer comparison
  ├── valuation.py      relative-valuation flags
  ├── screener.py       multi-criteria filtering
  ├── portfolio.py      CSV upload → value, return %, XIRR, allocation
  └── database.py       SQLite, scoped by session cookie
        │
        ▼
REST API (JSON) — /api/*
        │
        ▼
Frontend (terminal UI + Chart.js) — /  or Vercel static
```

## Quick start (local)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000** — the backend serves the frontend. The repo
ships with `data/cache/stocks.seed.json` (50 tickers + all tracked indices,
realistic demo values) so the UI is fully populated on the very first
request — no waiting on Yahoo, no empty screens. A background task then
tries a live yfinance refresh a few seconds after boot and upgrades the
cache in place when it succeeds; if Yahoo rate-limits you (very common from
cloud/CI IPs), the seed data just stays up until the next successful
refresh. API docs: **http://localhost:8000/docs**

### Tests

```bash
# Backend (18 tests, yfinance fully mocked — no network needed)
cd backend && pytest tests/ -v

# Frontend (8 tests, jsdom + mocked fetch — no backend needed)
cd frontend && npm install && npm test
```

## Features

| Feature | Endpoint(s) |
|---|---|
| Coverage universe | `GET /api/stocks` |
| Company detail (+ price chart) | `GET /api/stock/{ticker}`, `/history` |
| Screener (5 live filters) | `GET /api/screener` |
| Sector / peer comparison | `GET /api/sectors`, `GET /api/sector/{sector}` |
| Valuation flags (Under/Fair/Over vs peers) | `GET /api/valuation` |
| Header strip (Nifty/Sensex/Bank Nifty/VIX + breadth) | `GET /api/market-summary` |
| All indices (core + sectoral) | `GET /api/indices` |
| Market open/closed chip (IST session window) | `GET /api/market-status` |
| Movers / heatmap | `GET /api/top-gainers`, `/api/top-losers`, `/api/heatmap` |
| Watchlist (session-scoped, capped at 100) | `GET/POST /api/watchlist`, `DELETE /api/watchlist/{ticker}` |
| Portfolio CSV → value, return %, XIRR, allocation | `POST /api/portfolio/upload`, `GET/DELETE /api/portfolio` |
| Portfolio CSV template download | `GET /api/portfolio/template` |
| Manual refresh (30s cooldown) | `POST /api/refresh` |
| Data-source health | `GET /api/status` |

Try portfolio upload with `sample_portfolio.csv` from the repo root, or the
in-app "download template" link on the Portfolio tab.

### Indices tab

`GET /api/indices` returns Nifty 50, Sensex, Bank Nifty, India VIX, plus
sectorals: Nifty IT / Auto / Pharma / FMCG / Metal / Energy / Realty and
Nifty Midcap 50. India VIX is styled as a volatility gauge (calm / elevated /
high), not a price index.

### Portfolio tab

Upload a CSV with columns `ticker, quantity, buy_price, buy_date`
(`YYYY-MM-DD`). The backend validates every row (ticker shape, positive
numbers, real dates, 200KB/500-row caps), stores it scoped to your session,
and returns invested value, current value, per-holding return %, portfolio
XIRR (Newton-Raphson, no scipy dependency), and sector allocation. Re-upload
to replace; "Clear" wipes it.

## Data notes & known limitations

- `yfinance` talks to Yahoo's public, unofficial endpoints. It rate-limits
  aggressively from shared/cloud IPs — that's expected, not a bug. The seed
  fallback plus 5-minute cache TTL are designed around that reality.
- Fundamentals occasionally come back `null` from Yahoo for specific tickers
  (e.g. `earnings_growth`, `ev_ebitda`) — treat nulls as "not reported this
  cycle," not as zero. The screener and sort logic both already do this
  (see `screener.py` / `sectors.py`).
- This is a research/screening tool, not investment advice. Valuation flags
  are a peer-relative heuristic (P/E & P/B premium vs sector average), not a
  DCF or fair-value estimate.

## Security hardening

| Issue | Fix |
|---|---|
| XSS via `innerHTML` | `escapeHtml()` on every dynamic string before insertion |
| DOM XSS via inline `onclick='...${ticker}'` | Replaced with `data-ticker` + delegated click listeners |
| Static path depended on cwd | `StaticFiles` uses absolute `config.FRONTEND_DIR` |
| Shared watchlist/portfolio | `ml_session` httponly cookie; all DB rows scoped by `session_id` |
| Session ID leaked via API response body | `database.get_holdings()` explicitly selects columns — never `SELECT *` — so `session_id` (the same value backing the httponly cookie) is never echoed into JSON, which would otherwise let any script read and replay it |
| CORS `*` | `CORS_ORIGINS` env var (comma-separated); credentials enabled when not `*` |
| Ticker path params unvalidated | Regex `^[A-Za-z0-9.^&=-]{1,20}$` before lookup |
| `/api/refresh` spam | 30s cooldown → HTTP 429 |
| Unbounded watchlist growth | Capped at 100 tickers per session |
| Portfolio CSV unbounded | Max 200KB / 500 rows; field validation with clear 400s |
| Event-loop blocking | Background loop uses `asyncio.to_thread()` around yfinance |
| `config.js` used `#` shell-style comments | Invalid JavaScript — threw a `SyntaxError` on load and broke the entire page, since it's the first script loaded. Fixed to `//` comments |
| Screener descending sort | `reverse=True` was flipping the "missing value" flag too, so rows with no data for the sort column floated to the *top* of a descending sort. Fixed so missing values always sort last regardless of direction (regression-tested) |

## Deployment (recommended: split)

Vercel serverless cannot host the long-running uvicorn process, background
refresh loop, or durable local SQLite. Deploy like this:

### 1. Backend → Railway (or Render / Fly.io)

**Railway**

1. Create a new project from this repo; set root directory to `backend/`.
2. `backend/Procfile` / `backend/railway.json` start `uvicorn main:app`.
3. Set env vars:
   - `CORS_ORIGINS=https://your-app.vercel.app` (no trailing slash)
   - `COOKIE_SAMESITE=none`
   - `COOKIE_SECURE=true`
4. Attach a persistent volume if you want SQLite/cache to survive restarts
   (or accept ephemeral disk for a demo — the seed file re-bootstraps a
   usable cache on every cold start regardless).

**Render** — see root `render.yaml` (set `CORS_ORIGINS` in the dashboard).

**Fly.io**:

```bash
cd backend
fly launch --name marketlens-api --no-deploy
fly secrets set CORS_ORIGINS=https://your-app.vercel.app COOKIE_SAMESITE=none COOKIE_SECURE=true
fly deploy
```

### 2. Frontend → Vercel

1. Import the repo; set **Root Directory** to `frontend/`.
2. Framework Preset: Other. Build uses `frontend/vercel.json`.
3. Set env var `MARKETLENS_API_BASE` to your backend URL, e.g.
   `https://marketlens-api.up.railway.app` (no trailing slash).
4. Deploy. The build injects that URL into `js/config.js`.

Local same-origin serving still works with an empty `MARKETLENS_API_BASE`.

### Vercel-only (not recommended)

If you must stay on Vercel alone, you would need to: drop the background
loop; refresh on demand / via Cron; move cache to Vercel KV and
watchlist/portfolio to Postgres; and stay under the free-tier 10s limit
(parallelize or shrink the universe). Prefer the split path above.

## Project structure

```
MarketLens/
├── backend/
│   ├── main.py              routes, session middleware, rate limit
│   ├── config.py             watchlist, indices, CORS, market hours, paths
│   ├── downloader.py         yfinance + cache + seed fallback
│   ├── database.py           session-scoped SQLite
│   ├── portfolio.py          CSV validation + XIRR
│   ├── screener.py / sectors.py / valuation.py / transform.py / schemas.py
│   ├── scripts/generate_seed.py   regenerates data/cache/stocks.seed.json
│   ├── Procfile / railway.json / fly.toml
│   ├── requirements.txt
│   └── tests/test_api.py     18 tests, yfinance fully mocked
├── frontend/
│   ├── index.html
│   ├── favicon.svg
│   ├── vercel.json
│   ├── css/style.css         terminal theme
│   ├── js/                   utils, api, app (glue), and one module per tab
│   ├── package.json
│   └── tests/dom.test.js     8 tests, jsdom + mocked fetch
├── data/cache/stocks.seed.json   demo data, regenerate with generate_seed.py
├── render.yaml
├── sample_portfolio.csv
└── README.md
```

## Intentionally not built

News/AI summaries/PDF export, Screener.in scraping, full candlestick/RSI/MACD
kits, and a 5,000-stock NSE universe — each is a separate project.
