<div align="center">

# MarketLens

**A live NSE equity research terminal** — screening, peer comparison, relative
valuation, sector heatmaps, real-time indices, watchlists, and portfolio
analytics, wrapped in a Bloomberg-style near-black/amber terminal UI.

[![Live App](https://img.shields.io/badge/Live%20App-market--iq--real--time--stock--research.vercel.app-E8A017?style=for-the-badge&logo=vercel&logoColor=white)](https://market-iq-real-time-stock-research.vercel.app)
[![API](https://img.shields.io/badge/API-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://marketiq-real-time-stock-research-3vw4.onrender.com/api/status)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](backend/requirements.txt)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](backend/main.py)
[![yfinance](https://img.shields.io/badge/Data-yfinance-8A9A8E?style=flat-square)](backend/downloader.py)
[![Chart.js](https://img.shields.io/badge/Charts-Chart.js-FF6384?style=flat-square&logo=chartdotjs&logoColor=white)](frontend/js/charts.js)
[![Tests](https://img.shields.io/badge/Tests-26%20passing-3DDC97?style=flat-square)](#tests)

**[🔴 Launch the live terminal →](https://market-iq-real-time-stock-research.vercel.app)**

</div>

---

## Live deployment

| Layer | Provider | URL |
|---|---|---|
| **Frontend** | Vercel | **[market-iq-real-time-stock-research.vercel.app](https://market-iq-real-time-stock-research.vercel.app)** |
| **Backend API** | Render | [marketiq-real-time-stock-research-3vw4.onrender.com](https://marketiq-real-time-stock-research-3vw4.onrender.com) |
| **API health** | Render | [/api/status](https://marketiq-real-time-stock-research-3vw4.onrender.com/api/status) |
| **API docs (Swagger)** | Render | [/docs](https://marketiq-real-time-stock-research-3vw4.onrender.com/docs) |
| **Source** | GitHub | [pragy34/MarketIQ-Real-Time-Stock-Research-Portfolio-Analytics-Platform](https://github.com/pragy34/MarketIQ-Real-Time-Stock-Research-Portfolio-Analytics-Platform) |

> **Note:** the backend runs on Render's free tier, which sleeps after ~15
> minutes of inactivity. The first request after a period of idle time can
> take 30–50 seconds to wake up — after that it's fast until it idles out
> again. This is a hosting-tier tradeoff, not an application issue; the
> seed-data fallback below means the UI is never empty even mid-wakeup.

## Architecture

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

## Preview

<div align="center">

| Screener | Portfolio |
|---|---|
| Live filters, sortable columns, click any row for a detail modal with a price chart | CSV upload → invested/current value, return %, XIRR, sector allocation |

*Terminal aesthetic: near-black base, amber accent, IBM Plex Mono / Libre Baskerville — built to feel like a real desk tool, not a template.*

</div>

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
refresh loop, or durable local SQLite. This project runs split — **Render
for the API, Vercel for the static frontend** — as shown in the
[live deployment table](#live-deployment) above. Railway and Fly.io work
identically if you'd rather use those.

### 1. Backend → Render

1. **New → Web Service** (not Blueprint — Blueprint defaults to a paid
   instance type unless `render.yaml` pins `plan: free` *and* you deploy via
   the Blueprint flow specifically).
2. Root Directory: `backend`. Build: `pip install -r requirements.txt`.
   Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Instance Type: **Free**.
4. Environment variables:
   ```
   PYTHON_VERSION=3.11.9
   CORS_ORIGINS=https://your-app.vercel.app   (no trailing slash)
   COOKIE_SAMESITE=none
   COOKIE_SECURE=true
   ```
   `PYTHON_VERSION` matters more than it looks: Render's default Python is
   whatever's newest, which frequently has no prebuilt `pandas` wheel yet —
   pip then tries to compile it from source and can hang for 10+ minutes.
   Pinning `3.11.9` (also set via `backend/.python-version` in this repo)
   sidesteps that entirely.
5. Create the service, wait for `Build successful` → `Your service is live`,
   then confirm `https://your-service.onrender.com/api/status` returns JSON.

Same steps apply to **Railway** (`backend/railway.json` / `Procfile`) or
**Fly.io** (`backend/fly.toml` — `fly launch --name marketlens-api
--no-deploy && fly secrets set CORS_ORIGINS=... COOKIE_SAMESITE=none
COOKIE_SECURE=true && fly deploy`) if you prefer either of those instead.

> Free-tier caveat: Render (and Railway's Hobby tier) sleep an idle service
> after ~15 minutes. First request after that takes 30–50s to wake up.

### 2. Frontend → Vercel

1. Import the repo; set **Root Directory** to `frontend`.
2. Framework Preset: Other. Build uses `frontend/vercel.json`.
3. Set env var `MARKETLENS_API_BASE` to your backend URL, e.g.
   `https://marketiq-real-time-stock-research-3vw4.onrender.com`
   (no trailing slash).
4. Deploy. The build injects that URL into `js/config.js`.
5. Copy the resulting Vercel URL and go back to your backend host to set
   `CORS_ORIGINS` to it exactly — this is the step people most often forget,
   and without it every API call fails with a CORS error in the browser
   console.

Local same-origin serving still works with an empty `MARKETLENS_API_BASE`.

### Verifying a fresh deploy

1. Open the Vercel URL, DevTools → Console: no CORS errors.
2. DevTools → Network: API calls hit your backend domain and return `200`.
3. DevTools → Application → Cookies: `ml_session` is set (proves the
   cross-origin session cookie — and therefore watchlist/portfolio
   persistence — is actually working, not just page rendering).
4. Add a ticker to the Watchlist, refresh the page, confirm it's still there.
5. Upload `sample_portfolio.csv` on the Portfolio tab, confirm it summarizes.

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

---

<div align="center">

**[🔴 Launch the live terminal →](https://market-iq-real-time-stock-research.vercel.app)**

Licensed under [MIT](LICENSE) · Data via [yfinance](https://github.com/ranaroussi/yfinance) (unofficial, best-effort) · Not investment advice.

</div>
