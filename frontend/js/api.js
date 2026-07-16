// Thin fetch wrapper around every backend route. Centralizing this means:
//  - one place to set the API base URL (injected by vercel.json at build time,
//    or same-origin "" when the FastAPI backend serves the frontend directly)
//  - one place to send credentials (needed for the ml_session cookie on a
//    cross-origin Vercel -> Railway/Render/Fly split deployment)
//  - consistent error messages surfaced to the UI instead of raw fetch/HTTP errors

const Api = (() => {
  const BASE = (typeof window !== "undefined" && window.MARKETLENS_API_BASE) || "";

  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(BASE + path, {
        credentials: "include",
        headers: options.body instanceof FormData
          ? undefined
          : { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      });
    } catch (networkErr) {
      throw new Error("Can't reach the MarketLens API — check your connection or try again shortly.");
    }

    if (res.status === 204) return null;

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      const detail =
        (payload && typeof payload === "object" && payload.detail) ||
        (typeof payload === "string" && payload) ||
        `Request failed (${res.status})`;
      const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      err.status = res.status;
      throw err;
    }
    return payload;
  }

  function qs(params) {
    const clean = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
    if (!clean.length) return "";
    return "?" + clean.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  }

  return {
    // ---- core coverage universe ----
    status: () => request("/api/status"),
    marketStatus: () => request("/api/market-status"),
    stocks: () => request("/api/stocks"),
    stock: (ticker) => request(`/api/stock/${encodeURIComponent(ticker)}`),
    history: (ticker, period = "3mo") =>
      request(`/api/stock/${encodeURIComponent(ticker)}/history${qs({ period })}`),
    refresh: () => request("/api/refresh", { method: "POST" }),

    // ---- screener ----
    screener: (params) => request(`/api/screener${qs(params)}`),

    // ---- sectors / peers ----
    sectors: () => request("/api/sectors"),
    sector: (sector) => request(`/api/sector/${encodeURIComponent(sector)}`),

    // ---- valuation ----
    valuation: () => request("/api/valuation"),

    // ---- market summary / movers / heatmap / indices ----
    marketSummary: () => request("/api/market-summary"),
    indices: () => request("/api/indices"),
    topGainers: (limit = 10) => request(`/api/top-gainers${qs({ limit })}`),
    topLosers: (limit = 10) => request(`/api/top-losers${qs({ limit })}`),
    heatmap: () => request("/api/heatmap"),

    // ---- watchlist ----
    watchlist: () => request("/api/watchlist"),
    addWatchlist: (ticker) =>
      request("/api/watchlist", { method: "POST", body: JSON.stringify({ ticker }) }),
    removeWatchlist: (ticker) =>
      request(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" }),

    // ---- portfolio ----
    portfolioSummary: () => request("/api/portfolio/summary"),
    portfolioUpload: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request("/api/portfolio/upload", { method: "POST", body: form });
    },
    portfolioClear: () => request("/api/portfolio", { method: "DELETE" }),
    portfolioTemplateUrl: () => BASE + "/api/portfolio/template",
  };
})();
