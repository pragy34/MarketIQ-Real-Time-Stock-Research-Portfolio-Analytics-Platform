// Portfolio tab: upload a holdings CSV (ticker, quantity, buy_price, buy_date),
// see current value / return% / XIRR and sector allocation, cross-referenced
// against the live stock cache. Persisted server-side, scoped by session.

function pfFmtMoney(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function pfFmtPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

async function renderPortfolio() {
  const empty = document.getElementById("pf-empty");
  const content = document.getElementById("pf-content");
  const errBox = document.getElementById("pf-error");
  errBox.style.display = "none";

  let summary;
  try {
    summary = await Api.portfolioSummary();
  } catch (e) {
    errBox.textContent = `Couldn't load portfolio: ${e.message}`;
    errBox.style.display = "block";
    return;
  }

  if (!summary.holdings || !summary.holdings.length) {
    empty.style.display = "block";
    content.style.display = "none";
    return;
  }
  empty.style.display = "none";
  content.style.display = "block";

  const returnClass = (summary.total_return_pct || 0) >= 0 ? "up" : "down";
  const xirrClass = (summary.xirr_pct || 0) >= 0 ? "up" : "down";

  document.getElementById("pf-summary").innerHTML = `
    <div class="pf-card">
      <div class="label">Invested</div>
      <div class="value">${pfFmtMoney(summary.total_invested)}</div>
    </div>
    <div class="pf-card">
      <div class="label">Current value</div>
      <div class="value">${pfFmtMoney(summary.total_current_value)}</div>
    </div>
    <div class="pf-card">
      <div class="label">Total return</div>
      <div class="value ${returnClass}">${pfFmtPct(summary.total_return_pct)}</div>
    </div>
    <div class="pf-card">
      <div class="label">XIRR (annualized)</div>
      <div class="value ${summary.xirr_pct === null ? "" : xirrClass}">${
        summary.xirr_pct === null ? "—" : pfFmtPct(summary.xirr_pct)
      }</div>
    </div>
  `;

  const allocEntries = Object.entries(summary.sector_allocation || {}).sort((a, b) => b[1] - a[1]);
  document.getElementById("pf-alloc").innerHTML = allocEntries.length
    ? allocEntries.map(([sector, pct]) =>
        `<span class="alloc-pill"><span class="alloc-sector">${escapeHtml(sector)}</span> ${pct.toFixed(1)}%</span>`
      ).join("")
    : `<span class="alloc-pill">Allocation unavailable — live prices not yet loaded</span>`;

  const tbody = document.getElementById("pf-holdings-body");
  tbody.innerHTML = summary.holdings.map((h) => {
    const retClass = h.return_pct === null ? "" : h.return_pct >= 0 ? "up" : "down";
    return `<tr data-ticker="${escapeHtml(h.ticker)}">
      <td>${escapeHtml(h.ticker)}</td>
      <td><span class="sector-pill">${escapeHtml(h.sector)}</span></td>
      <td class="num">${escapeHtml(fmt(h.quantity))}</td>
      <td class="num">₹${escapeHtml(fmt(h.buy_price))}</td>
      <td class="num">${escapeHtml(h.buy_date)}</td>
      <td class="num">${h.current_price !== null ? "₹" + escapeHtml(fmt(h.current_price)) : "—"}</td>
      <td class="num">${pfFmtMoney(h.invested_value)}</td>
      <td class="num">${pfFmtMoney(h.current_value)}</td>
      <td class="num ${retClass}">${h.return_pct === null ? "—" : pfFmtPct(h.return_pct)}</td>
    </tr>`;
  }).join("");
  bindTickerRowClicks(tbody);
}

function pfSetStatus(msg, isError) {
  const box = document.getElementById("pf-upload-status");
  box.textContent = msg;
  box.className = "upload-status " + (isError ? "err" : "ok");
  box.style.display = msg ? "block" : "none";
}

function initPortfolioControls() {
  const fileInput = document.getElementById("pf-file-input");
  const uploadBtn = document.getElementById("pf-upload-btn");
  const clearBtn = document.getElementById("pf-clear-btn");
  const templateLink = document.getElementById("pf-template-link");

  templateLink.href = Api.portfolioTemplateUrl();

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      pfSetStatus("Choose a CSV file first.", true);
      return;
    }
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";
    pfSetStatus("", false);
    try {
      await Api.portfolioUpload(file);
      pfSetStatus(`Uploaded ${file.name} — portfolio updated.`, false);
      fileInput.value = "";
      await renderPortfolio();
    } catch (e) {
      pfSetStatus(e.message, true);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload";
    }
  });

  clearBtn.addEventListener("click", async () => {
    if (!confirm("Clear your uploaded portfolio? This can't be undone.")) return;
    try {
      await Api.portfolioClear();
      pfSetStatus("Portfolio cleared.", false);
      await renderPortfolio();
    } catch (e) {
      pfSetStatus(e.message, true);
    }
  });
}
