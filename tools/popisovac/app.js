// ─────────────────────────────────────────────────────────────
//  Popisovač – the interface
//  Reads the catalogue + saved examples, lets the visitor pick options,
//  calls the AI (ai.js) and shows the result in tabs per market.
//
//  Sections:  1 state · 2 helpers · 3 texts (SK/EN) · 4 form
//             5 API key · 6 generating · 7 results · 8 start
// ─────────────────────────────────────────────────────────────

import { MARKETS, LIMITS, UI } from "./texts.js";
import { generateDescriptions, explainError } from "./ai.js";

const SHARED = "../../shared/";
const KEY_STORAGE = "popisovac.apiKey";
const LANG_STORAGE = "popisovac.uiLang";

// ── 1) State: everything the app currently "knows" ───────────
const state = {
  uiLang: "sk",
  products: [],          // catalogue from shared/products.json
  examples: [],          // saved demo results from examples.json
  source: "catalog",     // "catalog" or "paste"
  productCode: null,
  tone: "friendly",
  length: "medium",
  markets: new Set(MARKETS.map((m) => m.id)),
  result: null,          // what is shown on the right (example or live)
  activeMarket: "sk",
  view: "preview",       // "preview" | "texts" | "compare"
  compareSide: "after",  // phone-only toggle in Before vs after
  busy: false,
  abort: null,           // AbortController of a running generation
};

// ── 2) Small helpers ─────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// t("chars", {n: 5, max: 60}) → "5 / 60 znakov"
function t(key, vars = {}) {
  const text = UI[state.uiLang][key] ?? UI.sk[key] ?? key;
  return typeof text === "string"
    ? text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "")
    : text;
}

// Escapes text before we put it into HTML (so "<" can't break the page).
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// localStorage can throw (private mode, blocked cookies) – so we wrap it.
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

const market = (id) => MARKETS.find((m) => m.id === id);
const currentProduct = () => state.products.find((p) => p.code === state.productCode) || null;
const hasKey = () => Boolean(storage.get(KEY_STORAGE));

// Makes AI HTML safe and Shoptet-clean: only h2/h3/p/ul/ol/li/strong/em/br,
// no attributes at all. Anything else is unwrapped (its text is kept),
// scripts/styles are dropped. Output is nicely indented for copying.
const ALLOWED = new Set(["H2", "H3", "P", "UL", "OL", "LI", "STRONG", "EM", "BR"]);
function cleanHtml(dirty) {
  const doc = new DOMParser().parseFromString(`<body>${dirty || ""}</body>`, "text/html");
  const walk = (node, depth) => {
    let out = "";
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        // Skip empty whitespace between blocks (e.g. between two <li>)
        if (!child.textContent.trim() && ["BODY", "UL", "OL"].includes(node.tagName)) continue;
        out += esc(child.textContent);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") continue;
      if (!ALLOWED.has(tag)) { out += walk(child, depth); continue; }
      const name = tag.toLowerCase();
      if (tag === "BR") { out += "<br>"; continue; }
      if (tag === "UL" || tag === "OL") {
        out += `<${name}>\n${walk(child, depth + 1)}</${name}>\n`;
      } else if (tag === "LI") {
        out += `${"  ".repeat(depth)}<li>${walk(child, depth).trim()}</li>\n`;
      } else if (tag === "STRONG" || tag === "EM") {
        out += `<${name}>${walk(child, depth)}</${name}>`;
      } else {
        out += `<${name}>${walk(child, depth).trim()}</${name}>\n`;
      }
    }
    return out;
  };
  // Drop whitespace-only text between blocks, then serialise.
  return walk(doc.body, 0).replace(/\n\s*\n/g, "\n").trim();
}

// Copies text and briefly shows "Copied ✓" on the button.
async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers / insecure contexts
    const area = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const original = button.textContent;
  button.textContent = t("copied");
  button.classList.add("done");
  setTimeout(() => { button.textContent = original; button.classList.remove("done"); }, 1600);
}

// ── 3) Interface texts (SK / EN switch) ──────────────────────
function applyTexts() {
  document.documentElement.lang = state.uiLang;
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$("[data-ui-lang]").forEach((b) => b.classList.toggle("on", b.dataset.uiLang === state.uiLang));
}

function setUiLang(lang) {
  state.uiLang = lang;
  storage.set(LANG_STORAGE, lang);
  applyTexts();
  renderModeBanner();
  renderProductSelect();
  renderExampleChips();
  renderGenerateButton();
  renderKeyStatus();
  if (state.busy) renderProgress();
  renderResults();
}

// ── 4) The form (left column) ────────────────────────────────

// Product dropdown, grouped by shop category.
function renderProductSelect() {
  const select = $("#productSelect");
  if (!state.products.length) return;
  const groups = {};
  state.products.forEach((p) => (groups[p.category] ||= []).push(p));
  select.innerHTML = Object.entries(groups).map(([category, items]) =>
    `<optgroup label="${esc(category)}">${items.map((p) =>
      `<option value="${esc(p.code)}"${p.code === state.productCode ? " selected" : ""}>${esc(p.name)}</option>`
    ).join("")}</optgroup>`).join("");
  renderProductCard();
}

// Small card under the dropdown: photo, brand, price and key specs.
function renderProductCard() {
  const p = currentProduct();
  const box = $("#productCard");
  if (!p) { box.innerHTML = ""; return; }
  const specs = [
    p.watts && `${String(p.watts).replace(/\.0$/, "")} W`,
    p.lumens && `${Math.round(p.lumens)} lm`,
    p.kelvin && `${Math.round(p.kelvin)} K`,
    p.ip && `IP${p.ip}`,
  ].filter(Boolean);
  // Prices in Slovak format: 3,49 €
  const eur = (n) => n.toLocaleString("sk-SK", { minimumFractionDigits: 2 }) + " €";
  const discount = p.commonPrice > p.price ? `<s>${eur(p.commonPrice)}</s>` : "";
  box.innerHTML = `
    <img src="${SHARED + esc(p.image)}" alt="" loading="lazy">
    <div>
      <div class="pc-brand">${esc(p.brand)} · #${esc(p.code)}</div>
      <div class="pc-price">${eur(p.price)} ${discount}</div>
      <div class="pc-specs">${specs.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
    </div>`;
}

// "Saved examples" quick buttons.
function renderExampleChips() {
  $("#exampleChips").innerHTML = state.examples.map((ex) => {
    const active = state.result?.origin === "example" && state.result.code === ex.code;
    return `<button type="button" class="chip${active ? " on" : ""}" data-example="${esc(ex.code)}">
      <img src="${SHARED}img/${esc(ex.code)}.jpg" alt="">${esc(ex.label[state.uiLang])}</button>`;
  }).join("");
}

// One checkbox per market.
function renderMarketChecks() {
  $("#marketChecks").innerHTML = MARKETS.map((m) => `
    <label class="mcheck">
      <input type="checkbox" value="${m.id}"${state.markets.has(m.id) ? " checked" : ""}>
      <span><b>${m.code}</b> ${esc(m.native)}</span>
    </label>`).join("");
}

function renderGenerateButton() {
  const label = $("#generateLabel");
  const btn = $("#generateBtn");
  btn.disabled = state.busy;
  btn.classList.toggle("needs-key", !hasKey());
  label.textContent = hasKey() ? t("generate") : t("generateNeedsKey");
}

// Segmented buttons (tone, length, source, view) share one helper.
function setSegment(container, attr, value) {
  container.querySelectorAll(`[data-${attr}]`).forEach((b) =>
    b.classList.toggle("on", b.dataset[attr] === value));
}

function bindForm() {
  $("#sourceSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("[data-source]");
    if (!b) return;
    state.source = b.dataset.source;
    setSegment($("#sourceSwitch"), "source", state.source);
    $("#srcCatalog").hidden = state.source !== "catalog";
    $("#srcPaste").hidden = state.source !== "paste";
  });

  $("#productSelect").addEventListener("change", (e) => {
    state.productCode = e.target.value;
    renderProductCard();
  });

  $("#toneSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tone]");
    if (b) { state.tone = b.dataset.tone; setSegment($("#toneSwitch"), "tone", state.tone); }
  });
  $("#lengthSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("[data-length]");
    if (b) { state.length = b.dataset.length; setSegment($("#lengthSwitch"), "length", state.length); }
  });

  $("#marketChecks").addEventListener("change", (e) => {
    if (e.target.checked) state.markets.add(e.target.value);
    else state.markets.delete(e.target.value);
  });
  $("#langAll").addEventListener("click", () => { MARKETS.forEach((m) => state.markets.add(m.id)); renderMarketChecks(); });
  $("#langNone").addEventListener("click", () => { state.markets.clear(); renderMarketChecks(); });

  $("#exampleChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-example]");
    if (b) showExample(b.dataset.example);
  });

  $("#form").addEventListener("submit", (e) => { e.preventDefault(); startGeneration(); });

  $$("[data-ui-lang]").forEach((b) => b.addEventListener("click", () => setUiLang(b.dataset.uiLang)));
}

function showFormError(key) {
  const box = $("#formError");
  box.hidden = !key;
  box.textContent = key ? t(key) : "";
}

// ── 5) API key (stored only in this browser) ─────────────────
function renderModeBanner() {
  const live = hasKey();
  const banner = $("#modeBanner");
  banner.hidden = false;
  banner.classList.toggle("live", live);
  $("#modeBadge").textContent = live ? t("liveBadge") : t("demoBadge");
  $("#modeText").textContent = live ? t("liveText") : t("demoText");
  $("#modeCta").hidden = live;
  $("#keyDot").classList.toggle("on", live);
}

function renderKeyStatus(messageKey) {
  $("#keyStatus").textContent = messageKey ? t(messageKey) : hasKey() ? t("keySaved") : "";
}

function openSettings() {
  const details = $("#settings");
  details.open = true;
  details.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => $("#apiKey").focus(), 300);
}

function bindSettings() {
  const input = $("#apiKey");
  if (hasKey()) input.value = storage.get(KEY_STORAGE);

  // Saving happens on form submit, so both the button and Enter work.
  $("#keyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = input.value.trim();
    if (!key.startsWith("sk-ant-")) { renderKeyStatus("keyEmpty"); return; }
    storage.set(KEY_STORAGE, key);
    renderKeyStatus("keySaved");
    renderModeBanner();
    renderGenerateButton();
    showFormError(null);
  });
  $("#keyRemove").addEventListener("click", () => {
    storage.remove(KEY_STORAGE);
    input.value = "";
    renderKeyStatus("keyRemoved");
    renderModeBanner();
    renderGenerateButton();
  });
  $("#modeCta").addEventListener("click", openSettings);
}

// ── 6) Generating live with Claude ───────────────────────────
const STEPS = ["step1", "step2", "step3", "step4", "step5"];
const progress = { step: 0, done: 0, total: 0, startedAt: 0, timer: null };

function renderProgress() {
  $("#progressSteps").innerHTML = STEPS.map((key, i) => {
    const status = i < progress.step ? "done" : i === progress.step ? "now" : "todo";
    return `<li class="${status}"><span class="dot"></span>${esc(t(key, { done: progress.done, total: progress.total }))}</li>`;
  }).join("");
  const secs = Math.floor((Date.now() - progress.startedAt) / 1000);
  $("#elapsed").textContent = t("elapsed", { time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` });
}

// Called by ai.js whenever something happens in the stream.
function onProgress(phase, info = {}) {
  const index = { connect: 1, thinking: 2, writing: 3, check: 4 }[phase];
  if (index > progress.step) progress.step = index;
  if (info.done !== undefined) progress.done = info.done;
  renderProgress();
}

function setBusy(busy) {
  state.busy = busy;
  $("#progress").hidden = !busy;
  // While generating, hide the badge/meta line of the previous result.
  $("#resultBadge").hidden = busy || !state.result;
  $("#resultMeta").hidden = busy;
  if (busy) { $("#emptyState").hidden = true; $("#output").hidden = true; $("#errorBox").hidden = true; }
  renderGenerateButton();
}

async function startGeneration() {
  showFormError(null);
  if (!hasKey()) { showFormError("generateNeedsKey"); openSettings(); return; }

  const product = state.source === "catalog" ? currentProduct() : null;
  const rawText = $("#pasteText").value.trim();
  const rawName = $("#pasteName").value.trim();
  if (!product && !rawText) { showFormError("pickSomething"); return; }
  if (!state.markets.size) { showFormError("pickLanguage"); return; }

  const marketIds = MARKETS.map((m) => m.id).filter((id) => state.markets.has(id));
  Object.assign(progress, { step: 0, done: 0, total: marketIds.length, startedAt: Date.now() });
  progress.timer = setInterval(renderProgress, 1000);
  state.abort = new AbortController();
  setBusy(true);
  renderProgress();
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const data = await generateDescriptions({
      apiKey: storage.get(KEY_STORAGE),
      product, rawText, rawName,
      tone: state.tone, length: state.length,
      marketIds, uiLang: state.uiLang,
      onProgress, signal: state.abort.signal,
    });
    state.result = {
      origin: "live",
      code: product?.code ?? null,
      product,
      original: product ? product.short || product.specs : rawText,
      tone: state.tone,
      length: state.length,
      review_notes: data.review_notes || [],
      results: data.results,
    };
    state.activeMarket = data.results[0]?.market ?? "sk";
    setBusy(false);
    renderExampleChips();
    renderResults();
  } catch (err) {
    console.error(err);
    setBusy(false);
    const { key, msg } = explainError(err);
    const box = $("#errorBox");
    box.hidden = false;
    box.innerHTML = `<b>⚠</b> ${esc(t(key, { msg }))}`;
    if (key === "errAuth") openSettings();
    if (state.result) $("#output").hidden = false; else $("#emptyState").hidden = false;
  } finally {
    clearInterval(progress.timer);
    state.abort = null;
  }
}

// ── 7) Results (right column) ────────────────────────────────

// Loads a saved example into the result area.
function showExample(code) {
  const ex = state.examples.find((e) => e.code === code);
  const product = state.products.find((p) => p.code === code);
  if (!ex || !product) return;
  state.result = {
    origin: "example",
    code,
    product,
    original: product.short || product.specs,
    tone: ex.tone,
    length: ex.length,
    review_notes: ex.review_notes,  // {sk:[…], en:[…]}
    results: ex.results,
  };
  if (!state.result.results.some((r) => r.market === state.activeMarket)) state.activeMarket = "sk";
  // Mirror the example's settings in the form, so it's clear how it was made.
  state.source = "catalog";
  state.productCode = code;
  state.tone = ex.tone;
  state.length = ex.length;
  setSegment($("#sourceSwitch"), "source", "catalog");
  $("#srcCatalog").hidden = false;
  $("#srcPaste").hidden = true;
  setSegment($("#toneSwitch"), "tone", ex.tone);
  setSegment($("#lengthSwitch"), "length", ex.length);
  renderProductSelect();
  renderExampleChips();
  $("#errorBox").hidden = true;
  renderResults();
}

function renderResults() {
  const r = state.result;
  $("#emptyState").hidden = Boolean(r) || state.busy;
  $("#output").hidden = !r || state.busy;
  const badge = $("#resultBadge");
  badge.hidden = !r;
  if (!r) { $("#resultMeta").textContent = ""; return; }

  badge.textContent = r.origin === "example" ? t("savedExample") : t("liveResult");
  badge.className = `pill ${r.origin === "example" ? "saved" : "live"}`;
  const name = r.product ? r.product.name : (r.results[0]?.product_name ?? "");
  $("#resultMeta").innerHTML = `<b>${esc(name)}</b> · ${esc(t("metaTone"))}: ${esc(t("tones")[r.tone])} · ${esc(t("metaLength"))}: ${esc(t("lengths")[r.length])}`;

  // Review notes: examples carry both languages, live results one.
  const notes = Array.isArray(r.review_notes) ? r.review_notes : r.review_notes[state.uiLang] || [];
  const notesBox = $("#notes");
  notesBox.hidden = !notes.length;
  notesBox.innerHTML = `<b>${esc(t("reviewNotes"))}</b><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;

  // Market tabs (country code + language name, no flags or currencies).
  $("#marketTabs").innerHTML = r.results.map((res) => {
    const m = market(res.market);
    return `<button type="button" role="tab" data-market="${m.id}" class="${m.id === state.activeMarket ? "on" : ""}"
      aria-selected="${m.id === state.activeMarket}"><b>${m.code}</b><span>${esc(m.native)}</span></button>`;
  }).join("");

  setSegment($("#viewSwitch"), "view", state.view);
  ["preview", "texts", "compare"].forEach((v) => {
    $(`#view${v[0].toUpperCase() + v.slice(1)}`).hidden = state.view !== v;
  });
  renderView();
}

const activeResult = () =>
  state.result?.results.find((r) => r.market === state.activeMarket) || state.result?.results[0];

function renderView() {
  const res = activeResult();
  if (!res) return;
  if (state.view === "preview") renderPreview(res);
  if (state.view === "texts") renderTexts(res);
  if (state.view === "compare") renderCompare(res);
}

// Google truncates long titles/descriptions with "…" – we imitate it.
const cut = (text, max) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);

// 7a) Live preview: Google result + product page of the local shop.
function renderPreview(res) {
  const m = market(res.market);
  const p = state.result.product;
  const slug = (p?.url || "").split("/").filter(Boolean).pop() || "produkt";
  const img = p ? `<img src="${SHARED + esc(p.image)}" alt="${esc(res.product_name)}">` : `<div class="no-img">${esc(t("noImage"))}</div>`;
  const stars = p && p.votes > 0
    ? `<div class="stars" aria-label="${p.rating} / 5">${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))} <span>(${p.votes})</span></div>` : "";

  $("#viewPreview").innerHTML = `
    <p class="mini-label">${esc(t("googleLabel"))}</p>
    <div class="serp" lang="${m.htmlLang}">
      <div class="serp-site"><span class="fav">${esc(m.shop[0])}</span>
        <div><b>${esc(m.shop)}</b><small>https://www.${esc(m.domain)} › ${esc(slug)}</small></div></div>
      <div class="serp-title">${esc(cut(res.seo_title, LIMITS.title))}</div>
      <p class="serp-desc">${esc(cut(res.meta_description, LIMITS.meta))}</p>
    </div>

    <p class="mini-label">${esc(t("pageLabel"))}</p>
    <div class="shop" lang="${m.htmlLang}">
      <div class="shop-bar"><span class="shop-logo">LED<b>${esc(m.shop.slice(3))}</b></span><span class="shop-dots"><i></i><i></i><i></i></span></div>
      <div class="shop-grid">
        <div class="shop-img">${img}</div>
        <div class="shop-info">
          <h1>${esc(res.product_name)}</h1>
          ${stars}
          <p class="shop-short">${esc(res.short_description)}</p>
          <ul class="shop-benefits">${res.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
          <span class="shop-cart">${esc(m.cart)}</span>
        </div>
      </div>
      <div class="shop-tabs"><span>${esc(m.descTab)}</span></div>
      <div class="shop-desc">${cleanHtml(res.description_html)}</div>
    </div>`;
}

// 7b) Texts: editable fields with counters and copy buttons.
function counter(len, max) {
  return `<span class="count ${len <= max ? "ok" : "over"}">${esc(t("chars", { n: len, max }))}</span>`;
}

function renderTexts(res) {
  const html = cleanHtml(res.description_html);
  $("#viewTexts").innerHTML = `
    <p class="muted small-text">✎ ${esc(t("editable"))}</p>
    <div class="field">
      <div class="field-head"><label for="fName">${esc(t("fName"))}</label>
        <button type="button" class="copy" data-copy="product_name">${esc(t("copy"))}</button></div>
      <input id="fName" data-field="product_name" value="${esc(res.product_name)}">
    </div>
    <div class="field">
      <div class="field-head"><label for="fTitle">${esc(t("fTitle"))}</label>
        <span class="right"><span id="cTitle">${counter(res.seo_title.length, LIMITS.title)}</span>
        <button type="button" class="copy" data-copy="seo_title">${esc(t("copy"))}</button></span></div>
      <input id="fTitle" data-field="seo_title" value="${esc(res.seo_title)}">
    </div>
    <div class="field">
      <div class="field-head"><label for="fMeta">${esc(t("fMeta"))}</label>
        <span class="right"><span id="cMeta">${counter(res.meta_description.length, LIMITS.meta)}</span>
        <button type="button" class="copy" data-copy="meta_description">${esc(t("copy"))}</button></span></div>
      <textarea id="fMeta" rows="4" data-field="meta_description">${esc(res.meta_description)}</textarea>
    </div>
    <div class="field">
      <div class="field-head"><label for="fShort">${esc(t("fShort"))}</label>
        <button type="button" class="copy" data-copy="short_description">${esc(t("copy"))}</button></div>
      <textarea id="fShort" rows="5" data-field="short_description">${esc(res.short_description)}</textarea>
    </div>
    <div class="two">
      <div class="field">
        <div class="field-head"><span class="flabel">${esc(t("fBenefits"))}</span>
          <button type="button" class="copy" data-copy="benefits">${esc(t("copy"))}</button></div>
        <ul class="benefits">${res.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>
      <div class="field">
        <div class="field-head"><span class="flabel">${esc(t("fKeywords"))}</span>
          <button type="button" class="copy" data-copy="keywords">${esc(t("copy"))}</button></div>
        <div class="kw">${res.keywords.map((k) => `<span>${esc(k)}</span>`).join("")}</div>
      </div>
    </div>
    <div class="field">
      <div class="field-head"><span class="flabel">${esc(t("fHtml"))}</span>
        <button type="button" class="copy primary" data-copy="html">${esc(t("copyHtml"))}</button></div>
      <pre class="code"><code>${esc(html)}</code></pre>
    </div>`;
}

// 7c) Before vs after: the shop's original text next to the new one.
function textStats(html, plain) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return {
    chars: (plain ?? doc.body.textContent).replace(/\s+/g, " ").trim().length,
    headings: doc.querySelectorAll("h2,h3").length,
    bullets: doc.querySelectorAll("li").length,
  };
}

function renderCompare(res) {
  const m = market(res.market);
  const original = (state.result.original || "").trim();
  const originalLines = original.split("\n").map((l) => l.trim()).filter(Boolean);
  const before = {
    chars: original.replace(/\s+/g, " ").length,
    headings: 0,
    bullets: originalLines.filter((l) => /^[-•–]/.test(l)).length,
  };
  const newHtml = cleanHtml(res.description_html);
  const after = textStats(`<p>${esc(res.short_description)}</p>${newHtml}`);
  const stat = (label, b, a) => `<div class="stat"><span>${esc(label)}</span><b>${esc(b)}</b><i>→</i><b class="up">${esc(a)}</b></div>`;

  $("#viewCompare").innerHTML = `
    <div class="stats">
      ${stat(t("statChars"), before.chars, after.chars)}
      ${stat(t("statHeadings"), before.headings, after.headings)}
      ${stat(t("statBullets"), before.bullets, after.bullets)}
      ${stat(t("statSeo"), t("no"), t("yes"))}
      ${stat(t("statLangs"), 1, state.result.results.length)}
    </div>
    <p class="muted small-text phone-only">${esc(t("compareHint"))}</p>
    <div class="seg ba-toggle phone-only" id="baToggle">
      <button type="button" data-side="before" class="${state.compareSide === "before" ? "on" : ""}">${esc(t("before"))}</button>
      <button type="button" data-side="after" class="${state.compareSide === "after" ? "on" : ""}">${esc(t("after"))}</button>
    </div>
    <div class="ba show-${state.compareSide}">
      <article class="ba-col before">
        <span class="ba-tag">${esc(t("before"))}</span>
        <h3>${esc(t("beforeTitle"))}</h3>
        <div class="ba-original">${original ? esc(original) : `<em>${esc(t("noOriginal"))}</em>`}</div>
      </article>
      <article class="ba-col after" lang="${m.htmlLang}">
        <span class="ba-tag">${esc(t("after"))}</span>
        <h3>${esc(t("afterTitle", { lang: m.native }))}</h3>
        <p class="shop-short">${esc(res.short_description)}</p>
        <div class="shop-desc">${newHtml}</div>
      </article>
    </div>`;
}

function bindResults() {
  $("#marketTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-market]");
    if (!b) return;
    state.activeMarket = b.dataset.market;
    renderResults();
  });
  $("#viewSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    state.view = b.dataset.view;
    renderResults();
  });

  // Phone toggle in Before vs after
  $("#viewCompare").addEventListener("click", (e) => {
    const b = e.target.closest("[data-side]");
    if (!b) return;
    state.compareSide = b.dataset.side;
    renderCompare(activeResult());
  });

  // Editing a field updates the result (and its counter) right away.
  $("#viewTexts").addEventListener("input", (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const res = activeResult();
    res[field] = e.target.value;
    if (field === "seo_title") $("#cTitle").innerHTML = counter(res.seo_title.length, LIMITS.title);
    if (field === "meta_description") $("#cMeta").innerHTML = counter(res.meta_description.length, LIMITS.meta);
  });

  // Copy buttons
  $("#viewTexts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const res = activeResult();
    const what = b.dataset.copy;
    const text =
      what === "html" ? cleanHtml(res.description_html)
      : what === "benefits" ? res.benefits.join("\n")
      : what === "keywords" ? res.keywords.join(", ")
      : res[what];
    copyText(text, b);
  });

  $("#cancelBtn").addEventListener("click", () => state.abort?.abort());
}

// ── 8) Start ─────────────────────────────────────────────────
async function init() {
  state.uiLang = storage.get(LANG_STORAGE) === "en" ? "en" : "sk";
  applyTexts();
  renderMarketChecks();
  bindForm();
  bindSettings();
  bindResults();
  renderModeBanner();
  renderKeyStatus();
  renderGenerateButton();
  renderResults();

  try {
    const [products, examples] = await Promise.all([
      fetch(SHARED + "products.json").then((r) => r.json()),
      fetch("examples.json").then((r) => r.json()),
    ]);
    state.products = products;
    state.examples = examples.examples;
    state.productCode = products[0]?.code ?? null;
    renderProductSelect();
    renderExampleChips();
    // No key yet → open straight into demo mode with the first saved example.
    if (!hasKey() && state.examples.length) showExample(state.examples[0].code);
  } catch (err) {
    console.error(err);
    $("#productSelect").innerHTML = `<option>${esc(t("catalogError"))}</option>`;
  }
}

init();
