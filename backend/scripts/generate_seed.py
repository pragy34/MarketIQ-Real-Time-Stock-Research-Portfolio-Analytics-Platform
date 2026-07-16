"""
One-off generator for data/cache/stocks.seed.json — realistic demo
fundamentals for the 50-stock default universe, keyed by sector, so the UI
never opens empty and the screener/valuation/peer views look sensible even
before a single live yfinance call succeeds. Deterministic (fixed RNG seed).

Run with:  python backend/scripts/generate_seed.py
"""
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

random.seed(42)

# ticker -> (Company name, sector, industry, base price)
STOCKS = {
    "RELIANCE.NS": ("Reliance Industries", "Energy", "Oil & Gas Refining", 2950),
    "TCS.NS": ("Tata Consultancy Services", "IT", "IT Services", 3900),
    "HDFCBANK.NS": ("HDFC Bank", "Financials", "Private Bank", 1650),
    "INFY.NS": ("Infosys", "IT", "IT Services", 1780),
    "ICICIBANK.NS": ("ICICI Bank", "Financials", "Private Bank", 1240),
    "BHARTIARTL.NS": ("Bharti Airtel", "Telecom", "Telecom Services", 1580),
    "SBIN.NS": ("State Bank of India", "Financials", "Public Bank", 820),
    "LT.NS": ("Larsen & Toubro", "Industrials", "Engineering & Construction", 3550),
    "ITC.NS": ("ITC Limited", "FMCG", "Diversified FMCG", 460),
    "HINDUNILVR.NS": ("Hindustan Unilever", "FMCG", "Household Products", 2450),
    "BEL.NS": ("Bharat Electronics", "Industrials", "Defence Electronics", 310),
    "HAL.NS": ("Hindustan Aeronautics", "Industrials", "Aerospace & Defence", 4650),
    "BAJFINANCE.NS": ("Bajaj Finance", "Financials", "NBFC", 7100),
    "MARUTI.NS": ("Maruti Suzuki", "Auto", "Passenger Vehicles", 12400),
    "AXISBANK.NS": ("Axis Bank", "Financials", "Private Bank", 1150),
    "KOTAKBANK.NS": ("Kotak Mahindra Bank", "Financials", "Private Bank", 1780),
    "SUNPHARMA.NS": ("Sun Pharmaceutical", "Pharma", "Pharmaceuticals", 1720),
    "TITAN.NS": ("Titan Company", "Consumer Discretionary", "Jewellery & Watches", 3350),
    "ULTRACEMCO.NS": ("UltraTech Cement", "Materials", "Cement", 11200),
    "WIPRO.NS": ("Wipro", "IT", "IT Services", 545),
    "NESTLEIND.NS": ("Nestle India", "FMCG", "Packaged Foods", 2380),
    "ADANIENT.NS": ("Adani Enterprises", "Conglomerate", "Diversified", 2900),
    "ADANIPORTS.NS": ("Adani Ports & SEZ", "Industrials", "Marine Port & Services", 1380),
    "ONGC.NS": ("Oil & Natural Gas Corp", "Energy", "Oil & Gas E&P", 265),
    "NTPC.NS": ("NTPC Limited", "Energy", "Power Generation", 365),
    "POWERGRID.NS": ("Power Grid Corp", "Energy", "Power Transmission", 315),
    "TATASTEEL.NS": ("Tata Steel", "Materials", "Steel", 148),
    "TATAMOTORS.NS": ("Tata Motors", "Auto", "Commercial & Passenger Vehicles", 985),
    "JSWSTEEL.NS": ("JSW Steel", "Materials", "Steel", 985),
    "COALINDIA.NS": ("Coal India", "Energy", "Coal Mining", 445),
    "HCLTECH.NS": ("HCL Technologies", "IT", "IT Services", 1780),
    "TECHM.NS": ("Tech Mahindra", "IT", "IT Services", 1620),
    "ASIANPAINT.NS": ("Asian Paints", "Materials", "Paints", 2650),
    "DIVISLAB.NS": ("Divi's Laboratories", "Pharma", "Pharmaceuticals", 5850),
    "DRREDDY.NS": ("Dr Reddy's Laboratories", "Pharma", "Pharmaceuticals", 1280),
    "CIPLA.NS": ("Cipla", "Pharma", "Pharmaceuticals", 1520),
    "BAJAJFINSV.NS": ("Bajaj Finserv", "Financials", "NBFC & Insurance", 1680),
    "BAJAJ-AUTO.NS": ("Bajaj Auto", "Auto", "Two & Three Wheelers", 9450),
    "EICHERMOT.NS": ("Eicher Motors", "Auto", "Two Wheelers", 4750),
    "HEROMOTOCO.NS": ("Hero MotoCorp", "Auto", "Two Wheelers", 5150),
    "GRASIM.NS": ("Grasim Industries", "Materials", "Diversified Materials", 2680),
    "HINDALCO.NS": ("Hindalco Industries", "Materials", "Aluminium", 680),
    "BPCL.NS": ("Bharat Petroleum", "Energy", "Oil Refining & Marketing", 315),
    "IOC.NS": ("Indian Oil Corp", "Energy", "Oil Refining & Marketing", 168),
    "SBILIFE.NS": ("SBI Life Insurance", "Financials", "Life Insurance", 1580),
    "HDFCLIFE.NS": ("HDFC Life Insurance", "Financials", "Life Insurance", 680),
    "BRITANNIA.NS": ("Britannia Industries", "FMCG", "Packaged Foods", 5250),
    "APOLLOHOSP.NS": ("Apollo Hospitals", "Healthcare", "Hospitals", 6850),
    "INDUSINDBK.NS": ("IndusInd Bank", "Financials", "Private Bank", 1420),
    "M&M.NS": ("Mahindra & Mahindra", "Auto", "Passenger & Commercial Vehicles", 2950),
}

# Rough sector-level fundamentals bands so the screener/peer-comparison
# story looks plausible (IT high margin/ROE, PSU banks low P/B, etc).
SECTOR_BANDS = {
    "IT":            dict(pe=(20, 32), pb=(6, 14), roe=(0.20, 0.45), de=(0, 15), margin=(0.14, 0.24)),
    "Financials":    dict(pe=(10, 26), pb=(1.8, 6.5), roe=(0.12, 0.20), de=(60, 110), margin=(0.15, 0.30)),
    "FMCG":          dict(pe=(35, 65), pb=(8, 16), roe=(0.20, 0.55), de=(0, 20), margin=(0.10, 0.22)),
    "Energy":        dict(pe=(6, 22), pb=(0.9, 2.8), roe=(0.08, 0.18), de=(20, 60), margin=(0.04, 0.12)),
    "Pharma":        dict(pe=(22, 38), pb=(3.5, 7.5), roe=(0.10, 0.22), de=(5, 30), margin=(0.14, 0.24)),
    "Auto":          dict(pe=(18, 36), pb=(3, 9), roe=(0.10, 0.24), de=(10, 45), margin=(0.06, 0.14)),
    "Materials":     dict(pe=(14, 32), pb=(2.5, 8), roe=(0.09, 0.20), de=(20, 55), margin=(0.06, 0.16)),
    "Industrials":   dict(pe=(20, 42), pb=(3, 9), roe=(0.10, 0.22), de=(15, 45), margin=(0.06, 0.16)),
    "Consumer Discretionary": dict(pe=(30, 55), pb=(8, 16), roe=(0.15, 0.28), de=(5, 25), margin=(0.08, 0.16)),
    "Healthcare":    dict(pe=(35, 60), pb=(6, 12), roe=(0.10, 0.18), de=(15, 40), margin=(0.06, 0.14)),
    "Telecom":       dict(pe=(28, 55), pb=(4, 9), roe=(0.04, 0.12), de=(90, 160), margin=(0.05, 0.12)),
    "Conglomerate":  dict(pe=(20, 45), pb=(2.5, 6), roe=(0.06, 0.14), de=(40, 90), margin=(0.03, 0.09)),
}


def rnd(lo, hi, nd=2):
    return round(random.uniform(lo, hi), nd)


def gen_row(ticker, name, sector, industry, base_price):
    band = SECTOR_BANDS.get(sector, dict(pe=(15, 35), pb=(2, 8), roe=(0.08, 0.20), de=(20, 60), margin=(0.06, 0.16)))
    prev_close = round(base_price * rnd(0.985, 1.015, 4), 2)
    price = round(prev_close * rnd(0.975, 1.025, 4), 2)
    change_pct = round((price - prev_close) / prev_close * 100, 2)

    pe = rnd(*band["pe"], 1)
    pb = rnd(*band["pb"], 2)
    roe = rnd(*band["roe"], 4)
    de = rnd(*band["de"], 1)
    margin = rnd(*band["margin"], 4)
    ev_ebitda = round(pe * rnd(0.55, 0.8, 2), 1)
    eps = round(price / pe, 2) if pe else None
    week_low = round(price * rnd(0.72, 0.9, 3), 2)
    week_high = round(price * rnd(1.08, 1.32, 3), 2)
    market_cap = round(price * rnd(2.5e8, 6.5e9, 0))

    return {
        "ticker": ticker,
        "shortName": name,
        "sector": sector,
        "industry": industry,
        "currentPrice": price,
        "previousClose": prev_close,
        "change_pct": change_pct,
        "marketCap": market_cap,
        "trailingPE": pe,
        "forwardPE": round(pe * rnd(0.85, 0.97, 2), 1),
        "priceToBook": pb,
        "enterpriseToEbitda": ev_ebitda,
        "returnOnEquity": roe,
        "returnOnAssets": round(roe * rnd(0.25, 0.6, 3), 4),
        "debtToEquity": de,
        "profitMargins": margin,
        "revenueGrowth": rnd(-0.04, 0.22, 4),
        "earningsGrowth": rnd(-0.08, 0.30, 4),
        "dividendYield": rnd(0.001, 0.028, 4),
        "beta": rnd(0.55, 1.35, 2),
        "fiftyTwoWeekHigh": week_high,
        "fiftyTwoWeekLow": week_low,
        "volume": int(rnd(3e5, 9e6, 0)),
        "trailingEps": eps,
        "error": None,
    }


def gen_indices():
    base = {
        "NIFTY 50": 24150.0, "SENSEX": 79480.0, "BANK NIFTY": 51220.0, "INDIA VIX": 13.4,
        "NIFTY IT": 41200.0, "NIFTY AUTO": 24800.0, "NIFTY PHARMA": 21600.0,
        "NIFTY FMCG": 57800.0, "NIFTY METAL": 9450.0, "NIFTY ENERGY": 42100.0,
        "NIFTY REALTY": 980.0, "NIFTY MIDCAP 50": 15200.0,
    }
    header, all_list = {}, []
    for label, symbol in config.ALL_INDEX_TICKERS.items():
        price = round(base.get(label, 10000.0) * rnd(0.99, 1.01, 4), 2)
        chg = rnd(-1.4, 1.4, 2)
        row = {"label": label, "symbol": symbol, "price": price, "change_pct": chg,
               "error": None, "is_vix": label == "INDIA VIX"}
        all_list.append(row)
        if label in config.HEADER_INDEX_TICKERS:
            header[label] = {"price": price, "change_pct": chg, "error": None}
    return header, all_list


def main():
    stocks = [gen_row(t, *v) for t, v in STOCKS.items()]
    indices, all_indices = gen_indices()
    payload = {
        "fetched_at": "2026-07-16T04:00:00+00:00",
        "source": "seed",
        "stocks": stocks,
        "indices": indices,
        "all_indices": all_indices,
    }
    out_path = config.SEED_FILE
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {len(stocks)} stocks + {len(all_indices)} indices -> {out_path}")


if __name__ == "__main__":
    main()
