"""
Generic multi-criteria screener. Every filter is optional (None = ignored),
mirroring how a real screener's filter panel works: an unset field doesn't
exclude anything.
"""


def screen(
    stocks: list[dict],
    max_pe: float | None = None,
    min_roe: float | None = None,
    max_de: float | None = None,
    min_margin: float | None = None,
    min_market_cap: float | None = None,
    min_dividend_yield: float | None = None,
    sector: str | None = None,
    sort_by: str = "roe",
    descending: bool = True,
) -> list[dict]:
    rows = stocks
    if max_pe is not None:
        rows = [r for r in rows if isinstance(r.get("pe_ttm"), (int, float)) and r["pe_ttm"] <= max_pe]
    if min_roe is not None:
        rows = [r for r in rows if isinstance(r.get("roe"), (int, float)) and r["roe"] >= min_roe]
    if max_de is not None:
        rows = [r for r in rows if isinstance(r.get("debt_to_equity"), (int, float)) and r["debt_to_equity"] <= max_de]
    if min_margin is not None:
        rows = [r for r in rows if isinstance(r.get("profit_margin"), (int, float)) and r["profit_margin"] >= min_margin]
    if min_market_cap is not None:
        rows = [r for r in rows if isinstance(r.get("market_cap"), (int, float)) and r["market_cap"] >= min_market_cap]
    if min_dividend_yield is not None:
        rows = [r for r in rows if isinstance(r.get("dividend_yield"), (int, float)) and r["dividend_yield"] >= min_dividend_yield]
    if sector:
        rows = [r for r in rows if r.get("sector") == sector]

    # IMPORTANT: rows with a missing value for `sort_by` must always sort to
    # the bottom, regardless of ascending/descending. A naive
    # `sorted(rows, key=lambda r: (v is None, v), reverse=descending)` gets
    # this backwards for descending sorts, because `reverse=True` also flips
    # the `(v is None, ...)` boolean — None-valued rows (True) would then
    # sort *before* real values (False). Instead we bake the direction into
    # the value itself and never reverse the "is missing" flag.
    def sort_key(r):
        v = r.get(sort_by)
        if v is None:
            return (1, 0)
        return (0, -v if descending else v)

    rows = sorted(rows, key=sort_key)
    return rows
