// App bootstrap: tab switching, header strip (index quotes + breadth +
// market-open chip + data-source banner), marquee ticker tape, and wiring
// every panel's init/render functions together. Loads last so every other
// script (utils, api, panel modules) is already defined.

const PANEL_RENDERERS = {
  screener: renderScreener,
  peers: renderPeers,
  valuation: renderValuation,
  movers: renderMovers,
  indices: renderIndices,
  watchlist: renderWatchlist,
  portfolio: renderPortfolio,
};
const renderedOnce = new Set();

function switchTab(panelName) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.panel === panelName));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${panelName}`));
  const renderer = PANEL_RENDERERS[panelName];
  if (renderer) renderer(); // always refresh on tab entry — cache TTL is 5min server-side, cheap to re-hit
  renderedOnce.add(panelName);
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.panel));
  });
}

// ---------------- Movers / heatmap ----------------
const HEAT_SCALE = [
  { max: -2, cls: "heat-n3" }, { max: -1, cls: "heat-n2" }, { max: 0, cls: "heat-n1" },
  { max: 1, cls: "heat-p1" }, { max: 2, cls: "heat-p2" }, { max: Infinity, cls: "heat-p3" },
];
function heatClass(v) {
  if (v === null || v === undefined) return "heat-n1";
  return (HEAT_SCALE.find((b) => v <= b.max) || HEAT_SCALE[HEAT_SCALE.length - 1]).cls;
}

function moverRow(s) {
  const cls = (s.change_pct || 0) >= 0 ? "up" : "down";
  return `<tr data-ticker="${escapeHtml(s.ticker)}">
    <td>${escapeHtml(s.ticker)}</td>
    <td class="nm">${escapeHtml(s.name)}</td>
    <td class="num">₹${escapeHtml(fmt(s.price))}</td>
    <td class="num ${cls}">${escapeHtml(fmt(s.change_pct))}%</td>
  </tr>`;
}

async function renderMovers() {
  try {
    const [gainers, losers, heat] = await Promise.all([Api.topGainers(8), Api.topLosers(8), Api.heatmap()]);
    const gBody = document.getElementById("gainers-body");
    const lBody = document.getElementById("losers-body");
    gBody.innerHTML = gainers.stocks.map(moverRow).join("");
    lBody.innerHTML = losers.stocks.map(moverRow).join("");
    bindTickerRowClicks(gBody);
    bindTickerRowClicks(lBody);

    const entries = Object.entries(heat).sort((a, b) => b[1].avg_change_pct - a[1].avg_change_pct);
    document.getElementById("heatmap-grid").innerHTML = entries.map(([sector, v]) => `
      <div class="heat-cell ${heatClass(v.avg_change_pct)}">
        <div class="sec">${escapeHtml(sector)}</div>
        <div class="chg">${v.avg_change_pct > 0 ? "+" : ""}${v.avg_change_pct}%</div>
      </div>
    `).join("");
  } catch (e) {
    document.getElementById("heatmap-grid").innerHTML =
      `<p class="empty-note">Couldn't load movers: ${escapeHtml(e.message)}</p>`;
  }
}

// ---------------- Header: index strip + market status + data banner ----------------
function renderIndexStrip(indices) {
  const strip = document.getElementById("index-strip");
  const order = ["NIFTY 50", "SENSEX", "BANK NIFTY", "INDIA VIX"];
  strip.innerHTML = order.map((label) => {
    const idx = indices[label];
    if (!idx || idx.price === null || idx.price === undefined) {
      return `<div class="index-card"><div class="label">${escapeHtml(label)}</div><div class="price">—</div></div>`;
    }
    const chgClass = idx.change_pct >= 0 ? "up" : "down";
    const chgStr = `${idx.change_pct > 0 ? "+" : ""}${idx.change_pct}%`;
    const isVix = label === "INDIA VIX";
    return `<div class="index-card${isVix ? " vix-card" : ""}">
      <div class="label">${escapeHtml(label)}</div>
      <div class="price">${Number(idx.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      <div class="chg ${chgClass}">${escapeHtml(chgStr)}</div>
    </div>`;
  }).join("");
}

function renderMarquee(stocks) {
  const track = document.getElementById("marquee");
  const items = stocks.filter((s) => s.price !== null && s.price !== undefined);
  if (!items.length) { track.innerHTML = ""; return; }
  const html = items.map((s) => {
    const cls = (s.change_pct || 0) >= 0 ? "mq-up" : "mq-down";
    const arrow = (s.change_pct || 0) >= 0 ? "▲" : "▼";
    return `<span class="mq-item" data-ticker="${escapeHtml(s.ticker)}">${escapeHtml(s.ticker.replace(".NS", ""))}
      <span class="mq-price">₹${escapeHtml(fmt(s.price))}</span>
      <span class="${cls}">${arrow} ${escapeHtml(fmt(Math.abs(s.change_pct || 0)))}%</span></span>`;
  }).join("");
  track.innerHTML = html + html; // duplicate for seamless scroll loop
  bindTickerRowClicks(track);
}

function renderDataBanner(meta) {
  const banner = document.getElementById("data-banner");
  if (!meta) { banner.style.display = "none"; return; }
  banner.style.display = "flex";
  if (meta.source === "seed") {
    banner.className = "sample-banner";
    banner.innerHTML = `Showing sample market data — live Yahoo Finance quotes are being fetched in the background.`;
  } else if (meta.fresh_count < meta.stock_count) {
    banner.className = "sample-banner err";
    banner.innerHTML = `${meta.fresh_count}/${meta.stock_count} tickers refreshed live — the rest are showing the last known values.`;
  } else {
    banner.className = "sample-banner ok";
    banner.innerHTML = `Live data — ${meta.stock_count} tickers, last updated ${meta.fetched_at ? new Date(meta.fetched_at).toLocaleTimeString() : "just now"}.`;
  }
}

function renderMarketStatusChip(status) {
  const chip = document.getElementById("market-status-chip");
  if (!status) { chip.style.display = "none"; return; }
  chip.style.display = "inline-flex";
  chip.className = "market-chip " + (status.is_open ? "chip-open" : "chip-closed");
  chip.innerHTML = `<span class="dot"></span>${status.is_open ? "Market open" : "Market closed"} · ${status.ist_time} IST`;
}

async function refreshHeader() {
  try {
    const [summary, status] = await Promise.all([Api.marketSummary(), Api.marketStatus()]);
    renderIndexStrip(summary.indices);
    renderMarketStatusChip(status);
  } catch (e) {
    // header is non-critical; fail quietly so a transient error doesn't blank the whole page
    console.warn("Header refresh failed:", e.message);
  }
}

async function refreshMarqueeAndBanner() {
  try {
    const { stocks, meta } = await Api.stocks();
    renderMarquee(stocks);
    renderDataBanner(meta);
  } catch (e) {
    console.warn("Marquee/banner refresh failed:", e.message);
  }
}

// ---------------- Manual refresh button ----------------
function initRefreshButton() {
  const btn = document.getElementById("refresh-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Refreshing…";
    try {
      await Api.refresh();
      await Promise.all([refreshHeader(), refreshMarqueeAndBanner()]);
      const activePanel = document.querySelector(".tab.active")?.dataset.panel;
      if (activePanel && PANEL_RENDERERS[activePanel]) await PANEL_RENDERERS[activePanel]();
    } catch (e) {
      alert(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

// ---------------- Boot ----------------
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initScreenerControls();
  initPeerControls();
  initWatchlistControls();
  initPortfolioControls();
  initRefreshButton();

  await loadSectorOptions();
  switchTab("screener");
  refreshHeader();
  refreshMarqueeAndBanner();

  // Keep the header strip and marquee reasonably live without hammering the
  // API — the backend cache itself only turns over every 5 minutes anyway.
  setInterval(refreshHeader, 60_000);
  setInterval(refreshMarqueeAndBanner, 90_000);
});
