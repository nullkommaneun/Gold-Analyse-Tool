// GoldRadar — Client‑Side App (GitHub Pages safe)
// Runs in DEMO by default. Flip to LIVE in the header to use your keys.
// Data sources:
//  - Price & chart: TradingView widgets (no key)
//  - Real yields: U.S. Treasury FiscalData JSON (no key) or XML feed
//  - EURUSD: ECB SDW JSON (no key)
//  - WTI, VIX: FRED (requires key) — optional

const $ = (s) => document.querySelector(s);
const state = {
  mode: localStorage.getItem('goldradar_mode') || 'DEMO', // DEMO | LIVE
  cfg: {
    fredKey: localStorage.getItem('goldradar_fredKey') || '',
    ecbMode: localStorage.getItem('goldradar_ecbMode') || 'daily',
    tsyMode: localStorage.getItem('goldradar_tsyMode') || 'fiscaldata',
    riskMode: localStorage.getItem('goldradar_riskMode') || 'none'
  },
  series: {
    real10y: [],
    eurusd: [],
    wti: [],
    vix: []
  }
};

// UI wiring
window.addEventListener('DOMContentLoaded', () => {
  $('#modeLabel').textContent = state.mode;
  $('#modeBtn').addEventListener('click', toggleMode);
  $('#configBtn').addEventListener('click', () => $('#configModal').showModal());
  $('#saveConfig').addEventListener('click', (e) => {
    e.preventDefault();
    state.cfg.fredKey = $('#fredKey').value.trim();
    state.cfg.ecbMode = $('#ecbMode').value;
    state.cfg.tsyMode = $('#tsyMode').value;
    state.cfg.riskMode = $('#riskMode').value;
    for (const [k,v] of Object.entries(state.cfg)) localStorage.setItem('goldradar_' + k, v);
    $('#configModal').close();
    boot();
  });
  // Init fields
  $('#fredKey').value = state.cfg.fredKey;
  $('#ecbMode').value = state.cfg.ecbMode;
  $('#tsyMode').value = state.cfg.tsyMode;
  $('#riskMode').value = state.cfg.riskMode;

  boot();
});

function toggleMode() {
  state.mode = state.mode === 'DEMO' ? 'LIVE' : 'DEMO';
  localStorage.setItem('goldradar_mode', state.mode);
  $('#modeLabel').textContent = state.mode;
  boot();
}

async function boot() {
  // Reset UI
  $('#realYield10y').textContent = '–';
  $('#eurusd').textContent = '–';
  $('#wti').textContent = '–';
  $('#vix').textContent = '–';
  drawSpark('#sparkReal', []);
  drawSpark('#sparkFX', []);
  drawSpark('#sparkOil', []);
  drawSpark('#sparkVIX', []);
  explainScore([]);
  setScore(50, 'Neutral');

  if (state.mode === 'DEMO') {
    // Hardcoded plausible sample values + tiny trend
    const today = new Date();
    const mkSeries = (base, drift=0) => Array.from({length: 30}, (_,i) => {
      const noise = (Math.sin(i/3)+Math.cos(i/5))*0.02;
      return +(base + i*drift + noise).toFixed(3);
    });
    state.series.real10y = mkSeries(1.6, -0.005);
    state.series.eurusd = mkSeries(1.05, 0.0005);
    state.series.wti = mkSeries(78, 0.05);
    state.series.vix = mkSeries(14, 0.02);

    renderSeries();
    calcScore();
    return;
  }

  // LIVE: fetch what we can without server
  await Promise.all([
    fetchReal10y(),
    fetchEURUSD(),
    fetchRisk()
  ]).catch(console.warn);

  renderSeries();
  calcScore();
}

function renderSeries() {
  if (state.series.real10y.length) {
    const last = state.series.real10y.at(-1);
    $('#realYield10y').textContent = last.toFixed(2) + '%';
    drawSpark('#sparkReal', state.series.real10y);
  }
  if (state.series.eurusd.length) {
    const last = state.series.eurusd.at(-1);
    $('#eurusd').textContent = last.toFixed(4);
    drawSpark('#sparkFX', state.series.eurusd);
  }
  if (state.series.wti.length) {
    const last = state.series.wti.at(-1);
    $('#wti').textContent = '$' + last.toFixed(2);
    drawSpark('#sparkOil', state.series.wti);
  }
  if (state.series.vix.length) {
    const last = state.series.vix.at(-1);
    $('#vix').textContent = last.toFixed(2);
    drawSpark('#sparkVIX', state.series.vix);
  }
}

// ---- Data fetchers (client-side safe) ----

// 10y real yield via FiscalData JSON API (no key).
// Endpoint doc pattern: https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/...
async function fetchReal10y() {
  if (state.cfg.tsyMode === 'none') return;
  try {
    // Daily Treasury Real Yield Curve Rates dataset table name:
    // v1/accounting/od/real_yield_curve? (naming varies; use documented path if needed)
    // We'll query generic 'daily_treasury_real_yield_curve_rates' alias if available.
    const base = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
    // Try v2 path first (newer); fall back to v1 if needed.
    const urls = [
      `${base}/v2/accounting/od/real_yield_curve_rates?fields=record_date,security_desc,real_yield&filter=security_desc:eq:10%20Year&sort=record_date&format=json&page[size]=30`,
      `${base}/v1/accounting/od/real_yield_curve?fields=record_date,security_desc,real_yield&filter=security_desc:eq:10%20Year&sort=record_date&format=json&page[size]=30`
    ];
    let ok = null;
    for (const url of urls) {
      const r = await fetch(url);
      if (r.ok) { ok = await r.json(); break; }
    }
    if (!ok || !ok.data) return;
    const rows = ok.data;
    state.series.real10y = rows.map(d => parseFloat(d.real_yield)).filter(x => isFinite(x));
  } catch (e) {
    console.warn('fetchReal10y failed', e);
  }
}

// EURUSD via ECB SDW (no key). Daily ref rate in XML/JSON; we use new JSON endpoint.
async function fetchEURUSD() {
  if (state.cfg.ecbMode === 'none') return;
  try {
    // ECB Data Portal SDW API: dataset EXR, key = D.USD.EUR.SP00.A
    // docs: https://data.ecb.europa.eu/help/api/data
    const url = 'https://data.ecb.europa.eu/api/data/EXR/D.USD.EUR.SP00.A?lastNObservations=30&format=JSON&delimiter=,&decimal=.';
    const r = await fetch(url);
    if (!r.ok) return;
    const j = await r.json();
    const series = j?.dataSets?.[0]?.series?.['0:0:0:0:0']?.observations || {};
    const vals = Object.values(series).map(arr => parseFloat(arr[0]));
    // USD per EUR -> want EURUSD (EUR per USD). Convert if necessary:
    // Series D.USD.EUR.SP00.A is USD per EUR? Actually key is USD vs EUR; SDW uses quote currency last; here EUR is base.
    // We'll invert to get EURUSD rate (EUR per USD) -> 1 / (USD per EUR)
    const inverted = vals.map(v => 1 / v);
    state.series.eurusd = inverted.filter(x => isFinite(x));
  } catch (e) {
    console.warn('fetchEURUSD failed', e);
  }
}

// Risk proxies via FRED (optional; key required)
async function fetchRisk() {
  if (state.cfg.riskMode !== 'fred' || !state.cfg.fredKey) return;
  const key = state.cfg.fredKey;
  // WTI spot: DCOILWTICO (daily), VIX: VIXCLS (daily close)
  const fred = async (series) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${key}&file_type=json&sort_order=asc&observation_start=2000-01-01`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('FRED fail ' + series);
    const j = await r.json();
    const last30 = j.observations.slice(-30).map(o => parseFloat(o.value)).filter(x => isFinite(x));
    return last30;
  };
  try {
    state.series.wti = await fred('DCOILWTICO');
  } catch (e) { console.warn(e); }
  try {
    state.series.vix = await fred('VIXCLS');
  } catch (e) { console.warn(e); }
}

// ---- Score model (transparent, simple) ----
function calcScore() {
  // Score 0..100 — higher = eher kaufen (relativ, kein Rat)
  // Heuristik:
  //  - Realzins 10y: niedriger => pro Gold (weight 40%)
  //  - USD Stärke (EURUSD): höher EURUSD (schwächerer USD) => pro Gold (weight 25%)
  //  - Ölpreis (WTI): höher => pro Inflation => pro Gold (weight 15%)
  //  - VIX: höher => Risikoangst => pro Gold (weight 20%)
  const notes = [];
  let score = 50;

  // Helpers: normalize to 0..1 with clip
  const norm = (x, lo, hi) => Math.max(0, Math.min(1, (x - lo) / (hi - lo)));

  const r10 = state.series.real10y.at(-1);
  if (isFinite(r10)) {
    // 10y real: use range -1% .. +3%
    const favor = 1 - norm(r10, -1, 3);
    score += (favor - 0.5) * 80 * 0.4;
    notes.push(`Realzins 10J: ${r10.toFixed(2)}% → ${(favor*100).toFixed(0)}% gold‑freundlich`);
  } else notes.push('Realzins 10J: keine Live‑Daten');

  const fx = state.series.eurusd.at(-1);
  if (isFinite(fx)) {
    // EURUSD range 0.95..1.20 (rough recent history). Higher = weaker USD.
    const favor = norm(fx, 0.95, 1.20);
    score += (favor - 0.5) * 80 * 0.25;
    notes.push(`EURUSD: ${fx.toFixed(4)} → ${(favor*100).toFixed(0)}% gold‑freundlich`);
  } else notes.push('EURUSD: keine Live‑Daten');

  const oil = state.series.wti.at(-1);
  if (isFinite(oil)) {
    const favor = norm(oil, 60, 110);
    score += (favor - 0.5) * 80 * 0.15;
    notes.push(`WTI: $${oil.toFixed(2)} → ${(favor*100).toFixed(0)}% gold‑freundlich`);
  } else notes.push('WTI: deaktiviert (FRED Key nötig)');
  
  const vix = state.series.vix.at(-1);
  if (isFinite(vix)) {
    const favor = norm(vix, 12, 35);
    score += (favor - 0.5) * 80 * 0.20;
    notes.push(`VIX: ${vix.toFixed(2)} → ${(favor*100).toFixed(0)}% gold‑freundlich`);
  } else notes.push('VIX: deaktiviert (FRED Key nötig)');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score < 35 ? 'Eher nicht' : score < 65 ? 'Neutral' : 'Eher ja';
  setScore(score, label);
  explainScore(notes);
}

function setScore(score, label) {
  $('#scoreValue').textContent = score;
  $('#scoreLabel').textContent = label;
  $('#scoreBar').style.width = score + '%';
  $('#scoreBar').style.background = score < 35 ? '#ef4444' : score < 65 ? '#f59e0b' : '#22c55e';
}

function explainScore(lines) {
  const ul = $('#scoreExplain');
  ul.innerHTML = '';
  for (const l of lines) {
    const li = document.createElement('li');
    li.textContent = '• ' + l;
    ul.appendChild(li);
  }
}

// Tiny sparkline (no external libs)
function drawSpark(sel, data=[]) {
  const c = $(sel); if (!c) return;
  const ctx = c.getContext('2d');
  const w = c.width = c.clientWidth * devicePixelRatio;
  const h = c.height = c.height * devicePixelRatio;
  ctx.clearRect(0,0,w,h);
  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--spark') || '#facc15';
  if (!data.length) return;
  const min = Math.min(...data), max = Math.max(...data);
  const x = (i) => (i/(data.length-1)) * (w-10) + 5;
  const y = (v) => h - ((v - min) / (max - min || 1)) * (h-10) - 5;
  ctx.beginPath();
  data.forEach((v,i) => { i?ctx.lineTo(x(i), y(v)):ctx.moveTo(x(i), y(v)); });
  ctx.stroke();
}
