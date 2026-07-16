// Watchlist tab: add/remove tickers (persisted server-side via SQLite),
// cross-referenced against the live stock cache for current price/P-E.

async function renderWatchlist() {
  const body = document.getElementById("watchlist-body");
  const empty = document.getElementById("watchlist-empty");
  let watchlist, stocks;
  try {
    ({ watchlist } = await Api.watchlist());
    ({ stocks } = await Api.stocks());
  } catch (e) {
    body.innerHTML = "";
    empty.style.display = "block";
    empty.textContent = `Couldn't load your watchlist: ${e.message}`;
    return;
  }
  empty.textContent = "Your watchlist is empty — add a ticker above.";
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));

  if (!watchlist.length) {
    body.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  body.innerHTML = watchlist.map(({ ticker }) => {
    const s = stockMap[ticker];
    if (!s) {
      return `<tr>
        <td>${escapeHtml(ticker)}</td>
        <td class="nm" colspan="5">Not in current coverage universe — add it to config.DEFAULT_WATCHLIST</td>
        <td><button type="button" class="btn small" data-action="remove-watchlist" data-ticker="${escapeHtml(ticker)}">Remove</button></td>
      </tr>`;
    }
    const chgClass = s.change_pct >= 0 ? "up" : "down";
    return `<tr data-ticker="${escapeHtml(s.ticker)}">
      <td>${escapeHtml(s.ticker)}</td>
      <td class="nm">${escapeHtml(s.name)}</td><td><span class="sector-pill">${escapeHtml(s.sector)}</span></td>
      <td class="num">${escapeHtml(fmt(s.price))}</td>
      <td class="num ${chgClass}">${escapeHtml(fmt(s.change_pct))}%</td>
      <td class="num">${escapeHtml(fmt(s.pe_ttm))}x</td>
      <td><button type="button" class="btn small" data-action="remove-watchlist" data-ticker="${escapeHtml(s.ticker)}">Remove</button></td>
    </tr>`;
  }).join("");
  bindTickerRowClicks(body);
}

async function removeFromWatchlist(ticker) {
  await Api.removeWatchlist(ticker);
  renderWatchlist();
}

function initWatchlistControls() {
  const addBtn = document.getElementById("wl-add-btn");
  const input = document.getElementById("wl-input");
  const doAdd = async () => {
    const ticker = input.value.trim().toUpperCase();
    if (!ticker) return;
    addBtn.disabled = true;
    try {
      await Api.addWatchlist(ticker);
      input.value = "";
      await renderWatchlist();
    } catch (e) {
      alert(e.message);
    } finally {
      addBtn.disabled = false;
    }
  };
  addBtn.addEventListener("click", doAdd);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });
}
