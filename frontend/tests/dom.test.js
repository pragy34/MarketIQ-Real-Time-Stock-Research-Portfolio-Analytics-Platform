// Frontend smoke tests (jsdom, mocked fetch — no real network / backend
// needed). Run with:  npm test
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { JSDOM } = require("jsdom");

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok — ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL — ${name}\n    ${e.message}`);
    failed++;
  }
}

function loadScript(dom, relPath) {
  const code = fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
  const indirectEval = dom.window.eval; // indirect eval runs against the window global, unlike direct eval
  indirectEval(code);
}

function freshDom() {
  const dom = new JSDOM(`<!DOCTYPE html><body></body>`, {
    url: "http://localhost/",
    runScripts: "dangerously",
  });
  dom.window.MARKETLENS_API_BASE = "";
  loadScript(dom, "js/config.js");
  loadScript(dom, "js/utils.js");
  loadScript(dom, "js/api.js");
  return dom;
}

// ---- utils.js: escapeHtml ----
test("escapeHtml escapes all dangerous characters", () => {
  const dom = freshDom();
  const out = dom.window.escapeHtml(`<script>alert('x')</script>&"'`);
  assert.strictEqual(
    out,
    "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;&quot;&#39;"
  );
});

test("escapeHtml handles null/undefined gracefully", () => {
  const dom = freshDom();
  assert.strictEqual(dom.window.escapeHtml(null), "");
  assert.strictEqual(dom.window.escapeHtml(undefined), "");
});

// ---- utils.js: bindTickerRowClicks delegation ----
test("bindTickerRowClicks opens modal for data-ticker elements", () => {
  const dom = freshDom();
  const { document } = dom.window;
  const container = document.createElement("div");
  container.innerHTML = `<div data-ticker="TCS.NS">TCS</div>`;
  document.body.appendChild(container);

  let openedWith = null;
  dom.window.openStockModal = (ticker) => { openedWith = ticker; };
  dom.window.bindTickerRowClicks(container);

  container.querySelector("[data-ticker]").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true })
  );
  assert.strictEqual(openedWith, "TCS.NS");
});

test("bindTickerRowClicks routes data-action clicks to the right handler, not the modal", () => {
  const dom = freshDom();
  const { document } = dom.window;
  const container = document.createElement("div");
  container.innerHTML = `<button data-action="remove-watchlist" data-ticker="INFY.NS">x</button>`;
  document.body.appendChild(container);

  let modalOpened = false, removedTicker = null;
  dom.window.openStockModal = () => { modalOpened = true; };
  dom.window.removeFromWatchlist = (ticker) => { removedTicker = ticker; };
  dom.window.bindTickerRowClicks(container);

  container.querySelector("[data-action]").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true })
  );
  assert.strictEqual(modalOpened, false);
  assert.strictEqual(removedTicker, "INFY.NS");
});

test("bindTickerRowClicks only binds once per container", () => {
  const dom = freshDom();
  const { document } = dom.window;
  const container = document.createElement("div");
  dom.window.bindTickerRowClicks(container);
  dom.window.bindTickerRowClicks(container);
  assert.strictEqual(container.dataset.delegatedBound, "1");
});

// ---- api.js: error surfacing ----
test("Api throws a readable error on HTTP failure with JSON detail", async () => {
  const dom = freshDom();
  dom.window.fetch = async () => ({
    ok: false,
    status: 400,
    headers: { get: () => "application/json" },
    json: async () => ({ detail: "Invalid ticker" }),
  });
  try {
    await dom.window.Api.stock("bad");
    assert.fail("expected throw");
  } catch (e) {
    assert.strictEqual(e.message, "Invalid ticker");
  }
});

test("Api surfaces a friendly message on network failure", async () => {
  const dom = freshDom();
  dom.window.fetch = async () => { throw new Error("network down"); };
  try {
    await dom.window.Api.stocks();
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e.message.includes("Can't reach"));
  }
});

test("Api.screener builds query string, skipping empty params", async () => {
  const dom = freshDom();
  let capturedUrl = null;
  dom.window.fetch = async (url) => {
    capturedUrl = url;
    return {
      ok: true, status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ count: 0, stocks: [] }),
    };
  };
  await dom.window.Api.screener({ max_pe: 30, sector: "", sort_by: "roe", descending: true });
  assert.ok(capturedUrl.includes("max_pe=30"));
  assert.ok(capturedUrl.includes("sort_by=roe"));
  assert.ok(!capturedUrl.includes("sector="));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
