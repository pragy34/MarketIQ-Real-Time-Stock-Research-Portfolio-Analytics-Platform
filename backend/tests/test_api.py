"""
Backend smoke tests. yfinance is never called — downloader.get_stocks /
fetch_index_summary / fetch_all_indices are monkeypatched with fixed data,
so tests are fast and deterministic regardless of network access.

Run with:  cd backend && pytest tests/ -v
"""
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

FAKE_STOCKS = [
    {
        "ticker": "RELIANCE.NS", "shortName": "Reliance Industries", "sector": "Energy",
        "industry": "Oil & Gas", "currentPrice": 2950.0, "previousClose": 2900.0,
        "change_pct": 1.72, "marketCap": 2.0e13, "trailingPE": 24.5, "forwardPE": 22.0,
        "priceToBook": 2.8, "enterpriseToEbitda": 12.0, "returnOnEquity": 0.11,
        "returnOnAssets": 0.06, "debtToEquity": 40.0, "profitMargins": 0.09,
        "revenueGrowth": 0.08, "earningsGrowth": 0.10, "dividendYield": 0.004,
        "beta": 0.9, "fiftyTwoWeekHigh": 3100.0, "fiftyTwoWeekLow": 2400.0,
        "volume": 5000000, "trailingEps": 120.0, "error": None,
    },
    {
        "ticker": "TCS.NS", "shortName": "Tata Consultancy Services", "sector": "IT",
        "industry": "IT Services", "currentPrice": 3900.0, "previousClose": 3950.0,
        "change_pct": -1.27, "marketCap": 1.4e13, "trailingPE": 29.0, "forwardPE": 26.0,
        "priceToBook": 13.0, "enterpriseToEbitda": 20.0, "returnOnEquity": 0.45,
        "returnOnAssets": 0.30, "debtToEquity": 5.0, "profitMargins": 0.20,
        "revenueGrowth": 0.06, "earningsGrowth": None, "dividendYield": 0.012,
        "beta": 0.7, "fiftyTwoWeekHigh": 4200.0, "fiftyTwoWeekLow": 3500.0,
        "volume": 2000000, "trailingEps": 130.0, "error": None,
    },
    {
        "ticker": "HDFCBANK.NS", "shortName": "HDFC Bank", "sector": "Financials",
        "industry": "Banking", "currentPrice": 1650.0, "previousClose": 1640.0,
        "change_pct": 0.61, "marketCap": 1.2e13, "trailingPE": 19.0, "forwardPE": 17.0,
        "priceToBook": 2.9, "enterpriseToEbitda": None, "returnOnEquity": None,
        "returnOnAssets": 0.02, "debtToEquity": 90.0, "profitMargins": 0.25,
        "revenueGrowth": 0.09, "earningsGrowth": 0.12, "dividendYield": 0.011,
        "beta": 0.95, "fiftyTwoWeekHigh": 1750.0, "fiftyTwoWeekLow": 1400.0,
        "volume": 8000000, "trailingEps": 86.0, "error": None,
    },
]

FAKE_INDICES_HEADER = {
    "NIFTY 50": {"price": 24150.0, "change_pct": 0.35, "error": None},
    "SENSEX": {"price": 79480.0, "change_pct": 0.30, "error": None},
    "BANK NIFTY": {"price": 51220.0, "change_pct": -0.10, "error": None},
    "INDIA VIX": {"price": 13.2, "change_pct": -2.1, "error": None},
}
FAKE_INDICES_ALL = [
    {"label": k, "symbol": s, "price": FAKE_INDICES_HEADER.get(k, {}).get("price", 100.0),
     "change_pct": FAKE_INDICES_HEADER.get(k, {}).get("change_pct", 0.0), "error": None,
     "is_vix": k == "INDIA VIX"}
    for k, s in {**FAKE_INDICES_HEADER, "NIFTY IT": "^CNXIT"}.items()
]


@pytest.fixture
def client(monkeypatch):
    import downloader

    monkeypatch.setattr(downloader, "get_stocks", lambda tickers, force_refresh=False: FAKE_STOCKS)
    monkeypatch.setattr(downloader, "fetch_index_summary", lambda: FAKE_INDICES_HEADER)
    monkeypatch.setattr(downloader, "fetch_all_indices", lambda: FAKE_INDICES_ALL)
    monkeypatch.setattr(downloader, "fetch_history", lambda ticker, period="3mo": [
        {"date": "2024-01-01", "close": 100.0}, {"date": "2024-01-02", "close": 101.5},
    ])
    monkeypatch.setattr(downloader, "ensure_cache_bootstrapped", lambda: {"stocks": FAKE_STOCKS})
    monkeypatch.setattr(downloader, "cache_meta", lambda: {
        "source": "mock", "fetched_at": "2024-01-01T00:00:00+00:00",
        "stock_count": len(FAKE_STOCKS), "fresh_count": len(FAKE_STOCKS),
        "refresh_in_progress": False, "is_seed": False,
    })
    monkeypatch.setattr(downloader, "refresh_cache", lambda tickers: FAKE_STOCKS)
    monkeypatch.setattr(downloader, "refresh_indices_live", lambda: None)

    import main
    with TestClient(main.app) as c:
        yield c


def test_stocks_endpoint(client):
    r = client.get("/api/stocks")
    assert r.status_code == 200
    body = r.json()
    assert len(body["stocks"]) == 3
    assert body["stocks"][0]["ticker"] == "RELIANCE.NS"


def test_stock_detail_not_found(client):
    r = client.get("/api/stock/NOTREAL.NS")
    assert r.status_code == 404


def test_stock_detail_valid(client):
    r = client.get("/api/stock/TCS.NS")
    assert r.status_code == 200
    assert r.json()["name"] == "Tata Consultancy Services"


def test_invalid_ticker_rejected(client):
    r = client.get("/api/stock/'; DROP TABLE watchlist;--")
    assert r.status_code == 400


def test_screener_descending_sort_puts_missing_values_last():
    """Regression test for the reverse=descending sort bug: rows with a
    None value for the sort field must always land at the bottom, not the top,
    even when sorting descending."""
    from screener import screen
    from transform import normalize_batch

    stocks = normalize_batch(FAKE_STOCKS)  # HDFCBANK.NS has roe=None
    results = screen(stocks, sort_by="roe", descending=True)
    assert results[-1]["ticker"] == "HDFCBANK.NS"
    assert results[0]["roe"] is not None
    assert results[0]["roe"] >= results[1]["roe"]


def test_screener_ascending_sort_still_puts_missing_values_last():
    from screener import screen
    from transform import normalize_batch

    stocks = normalize_batch(FAKE_STOCKS)
    results = screen(stocks, sort_by="roe", descending=False)
    assert results[-1]["ticker"] == "HDFCBANK.NS"
    assert results[0]["roe"] <= results[1]["roe"]


def test_screener_filters_by_max_pe(client):
    r = client.get("/api/screener", params={"max_pe": 25})
    assert r.status_code == 200
    tickers = {s["ticker"] for s in r.json()["stocks"]}
    assert "TCS.NS" not in tickers  # PE 29 excluded
    assert "RELIANCE.NS" in tickers  # PE 24.5 included


def test_valuation_flags_present(client):
    r = client.get("/api/valuation")
    assert r.status_code == 200
    flags = {s["valuation_flag"] for s in r.json()["stocks"]}
    assert flags  # non-empty, all rows got a flag
    assert flags <= {"Undervalued vs peers", "Fairly valued vs peers", "Overvalued vs peers", "Insufficient data"}


def test_sectors_averages(client):
    r = client.get("/api/sectors")
    assert r.status_code == 200
    assert "IT" in r.json()


def test_indices(client):
    r = client.get("/api/indices")
    assert r.status_code == 200
    labels = {i["label"] for i in r.json()["indices"]}
    assert "NIFTY 50" in labels


def test_market_status_shape(client):
    r = client.get("/api/market-status")
    assert r.status_code == 200
    body = r.json()
    assert "is_open" in body and "ist_time" in body


def test_watchlist_add_remove(client):
    r = client.post("/api/watchlist", json={"ticker": "tcs.ns"})
    assert r.status_code == 200
    assert r.json()["added"] == "TCS.NS"

    r = client.get("/api/watchlist")
    tickers = [w["ticker"] for w in r.json()["watchlist"]]
    assert "TCS.NS" in tickers

    r = client.delete("/api/watchlist/TCS.NS")
    assert r.status_code == 200

    r = client.get("/api/watchlist")
    tickers = [w["ticker"] for w in r.json()["watchlist"]]
    assert "TCS.NS" not in tickers


def test_watchlist_rejects_bad_ticker(client):
    r = client.post("/api/watchlist", json={"ticker": "<script>"})
    assert r.status_code == 422


def test_portfolio_upload_and_summary(client):
    csv_bytes = (
        b"ticker,quantity,buy_price,buy_date\n"
        b"RELIANCE.NS,10,2500,2024-01-01\n"
        b"TCS.NS,5,4000,2024-02-01\n"
    )
    r = client.post(
        "/api/portfolio/upload",
        files={"file": ("portfolio.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["holdings"]) == 2
    assert body["total_invested"] == 10 * 2500 + 5 * 4000

    r = client.get("/api/portfolio/summary")
    assert r.status_code == 200
    assert len(r.json()["holdings"]) == 2

    r = client.delete("/api/portfolio")
    assert r.status_code == 200
    r = client.get("/api/portfolio/summary")
    assert r.json()["holdings"] == []


def test_portfolio_upload_rejects_bad_csv(client):
    r = client.post(
        "/api/portfolio/upload",
        files={"file": ("bad.csv", io.BytesIO(b"not,the,right,columns\n1,2,3,4\n"), "text/csv")},
    )
    assert r.status_code == 400


def test_portfolio_template(client):
    r = client.get("/api/portfolio/template")
    assert r.status_code == 200
    assert "ticker,quantity,buy_price,buy_date" in r.text


def test_refresh_cooldown(client):
    r1 = client.post("/api/refresh")
    assert r1.status_code == 200
    r2 = client.post("/api/refresh")
    assert r2.status_code == 429


def test_session_cookie_issued(client):
    r = client.get("/api/stocks")
    assert "ml_session" in r.cookies
