/* ==========================================================================
   Bannerovač – app.js
   The interface: choosing a product, deal and style, building the texts
   for each market, previews, the large viewer and downloads.
   Drawing itself is in render.js, country data in markets.js.
   ========================================================================== */

/* --- Interface texts (SK / EN) ------------------------------------------- */
const UI = {
  sk: {
    back: '← <b>Portfólio Emílie Schmidtovej</b>',
    eyebrow: 'Nástroj · E-commerce marketing',
    pitch: 'Jeden produkt, 8 krajín, 4 formáty. Promo bannery pre sieť e-shopov LEDAKCIA – s cenami, menami a textami tak, ako ich píšu miestni zákazníci.',
    campaignBtn: 'Kampaň 1+1 – ukážka',
    campaignHint: 'Reflektor so senzorom, 8 krajín, všetky formáty.',
    howTitle: 'Ako to funguje',
    step1t: 'Vyber produkt a akciu', step1d: 'Z reálneho katalógu – napr. 1+1 zadarmo alebo −25 %.',
    step2t: 'Zvoľ vizuálny štýl', step2d: '4 šablóny. Texty sa samy zmenšia, aby sa vždy zmestili.',
    step3t: 'Stiahni pre všetky krajiny', step3d: 'Až 32 bannerov naraz – jednotlivo ako PNG alebo v ZIP-e.',
    pProduct: 'Produkt', searchPh: 'Hľadať názov, kategóriu alebo kód…', noResults: 'Nič sa nenašlo.',
    pDeal: 'Akcia', pctLabel: 'Výška zľavy',
    deals: { '1+1': '1+1 zadarmo', '2+1': '2+1 zadarmo', '5+5': '5+5 zadarmo', pct: 'Zľava %', new: 'Novinka', sale: 'Výpredaj' },
    pStyle: 'Vizuálny štýl',
    styles: {
      amber: ['Amber glow', 'Tmavé pozadie, teplé svetlo za produktom'],
      clean: ['Clean white', 'Svetlé, vzdušné, produkt splynie s pozadím'],
      bold:  ['Bold sale', 'Veľké písmo, žltá, výpredajová energia'],
      night: ['Night outdoor', 'Nočná obloha – na solárne a vonkajšie svetlá'],
    },
    pTexts: 'Texty pre krajiny',
    textsNote: 'Akcie, výzvy, ceny a meny sa lokalizujú automaticky. Názov produktu sa neprekladá strojovo (nástroj beží offline, bez AI) – SK názov sa skopíruje do všetkých jazykov a môžeš ho prepísať.',
    nameLabel: 'Krátky názov na banner (SK)',
    locSummary: 'Upraviť názov a nadpis pre každý jazyk',
    colName: 'Názov produktu', colHead: 'Nadpis (prázdne = predvolený)',
    copySk: 'Skopírovať SK názov do všetkých',
    pOutput: 'Formáty a trhy',
    formats: { hero: 'Web hero', ig: 'IG post', story: 'IG story', fb: 'Facebook' },
    pPrices: 'Ceny podľa krajín', priceNote: 'Ceny sú ilustračné – prepočítané z katalógového snapshotu podľa cenových pravidiel jednotlivých e-shopov (napr. 49,99 € = 1 299 Kč = 229,99 zł).',
    all: 'Všetky',
    showcaseBtn: 'Export showcase', zipBtn: 'Stiahnuť všetko (ZIP)',
    toShowcase: 'Do showcase', downloadPng: 'Stiahnuť PNG', download: 'Stiahnuť',
    status: (n) => `${n} bannerov · klikni na náhľad pre veľké zobrazenie · ★ označí banner pre showcase export`,
    working: (i, n) => `Pripravujem PNG ${i} / ${n}…`,
    done: (n) => `Hotovo – ${n} súborov stiahnutých.`,
    noZip: 'ZIP knižnica sa nenačítala (offline?). Sťahujem súbory jednotlivo.',
    nothingStarred: 'Najprv označ hviezdičkou (★) bannery pre showcase.',
    campaignDone: 'Kampaň pripravená: 1+1 na reflektor 30 W v 8 krajinách. Pre showcase sú označené IG posty a SK web hero.',
    loading: 'Načítavam katalóg a písma…',
    loadError: 'Katalóg sa nepodarilo načítať. Spusti stránku cez lokálny server (nie file://).',
  },
  en: {
    back: '← <b>Emília Schmidtová’s portfolio</b>',
    eyebrow: 'Tool · E-commerce marketing',
    pitch: 'One product, 8 countries, 4 formats. Promo banners for the LEDAKCIA e-shop network – with prices, currencies and copy written the way local shoppers expect.',
    campaignBtn: '1+1 campaign – demo',
    campaignHint: 'Motion-sensor floodlight, 8 countries, every format.',
    howTitle: 'How it works',
    step1t: 'Pick a product and a deal', step1d: 'From the real catalogue – e.g. buy one get one free or −25 %.',
    step2t: 'Choose a visual style', step2d: '4 templates. Text shrinks itself so it always fits.',
    step3t: 'Download for every country', step3d: 'Up to 32 banners at once – single PNGs or a ZIP.',
    pProduct: 'Product', searchPh: 'Search name, category or code…', noResults: 'Nothing found.',
    pDeal: 'Deal', pctLabel: 'Discount',
    deals: { '1+1': '1+1 free', '2+1': '2+1 free', '5+5': '5+5 free', pct: 'Discount %', new: 'New', sale: 'Clearance' },
    pStyle: 'Visual style',
    styles: {
      amber: ['Amber glow', 'Dark background, warm light behind the product'],
      clean: ['Clean white', 'Light and airy, product blends into the page'],
      bold:  ['Bold sale', 'Big type, yellow, clearance energy'],
      night: ['Night outdoor', 'Night sky – for solar and outdoor lights'],
    },
    pTexts: 'Copy per country',
    textsNote: 'Deals, calls to action, prices and currencies are localised automatically. Product names are not machine-translated (the tool runs offline, no AI) – the SK name is copied to every language and you can overwrite it.',
    nameLabel: 'Short banner name (SK)',
    locSummary: 'Edit name and headline per language',
    colName: 'Product name', colHead: 'Headline (empty = default)',
    copySk: 'Copy SK name to all',
    pOutput: 'Formats & markets',
    formats: { hero: 'Web hero', ig: 'IG post', story: 'IG story', fb: 'Facebook' },
    pPrices: 'Prices by country', priceNote: 'Prices are illustrative – converted from a catalogue snapshot using each shop’s pricing rules (e.g. €49.99 = 1 299 Kč = 229,99 zł).',
    all: 'All',
    showcaseBtn: 'Export showcase', zipBtn: 'Download all (ZIP)',
    toShowcase: 'Add to showcase', downloadPng: 'Download PNG', download: 'Download',
    status: (n) => `${n} banners · click a preview to enlarge · ★ marks a banner for the showcase export`,
    working: (i, n) => `Preparing PNG ${i} / ${n}…`,
    done: (n) => `Done – ${n} files downloaded.`,
    noZip: 'ZIP library did not load (offline?). Downloading files one by one.',
    nothingStarred: 'First star (★) the banners you want in the showcase.',
    campaignDone: 'Campaign ready: 1+1 on the 30 W floodlight in 8 countries. IG posts and the SK web hero are starred for the showcase.',
    loading: 'Loading catalogue and fonts…',
    loadError: 'Could not load the catalogue. Open the page through a local server (not file://).',
  },
};

const FORMAT_ORDER = ['ig', 'story', 'fb', 'hero'];
const STYLE_ORDER = ['amber', 'clean', 'bold', 'night'];
const DEAL_ORDER = ['1+1', '2+1', '5+5', 'pct', 'new', 'sale'];

/* --- App state: everything the user has chosen --------------------------- */
const state = {
  ui: 'sk',
  products: [],
  product: null,
  deal: '1+1',          // '1+1' | '2+1' | '5+5' | 'pct' | 'new' | 'sale'
  pct: 25,
  style: 'amber',
  names: {},            // product name per market (cc → text)
  heads: {},            // custom headline per market (empty = default phrase)
  formats: new Set(FORMAT_ORDER),
  markets: new Set(MARKETS.map(m => m.cc)),
  tab: 'all',
  showcase: new Set(),  // "fmt:cc" keys starred for the showcase export
};

const $ = (sel) => document.querySelector(sel);
const t = (key) => UI[state.ui][key];

/* ==========================================================================
   Building the banner content for one market
   ========================================================================== */

/** Products sold as "1+1" in the catalogue already show the price for 2 pieces. */
function isBogoProduct(p) {
  return /1\s*\+\s*1/.test(p.name) || (p.commonPrice > 0 && Math.abs(p.commonPrice - 2 * p.price) < 0.02);
}

/** Prices in EUR for the chosen deal: { now, old, total } (total = pieces). */
function dealPricesEUR(p, deal, pct) {
  const bogo = isBogoProduct(p);
  const unit = bogo ? p.commonPrice / 2 : p.price;        // price of one piece
  if (/^\d+\+\d+$/.test(deal)) {
    const [buy, get] = deal.split('+').map(Number);
    return { now: unit * buy, old: unit * (buy + get), total: buy + get, buy };
  }
  if (deal === 'pct') {
    const ref = bogo ? unit : Math.max(p.price, p.commonPrice || 0);
    // the catalogue's own discount → use its real price; otherwise round to …,99
    const now = !bogo && pct === catalogueDiscount(p) ? p.price : endIn99(ref * (1 - pct / 100));
    return { now, old: ref };
  }
  if (deal === 'sale') {
    const old = !bogo && p.commonPrice > p.price ? p.commonPrice : null;
    return { now: bogo ? unit : p.price, old };
  }
  return { now: bogo ? unit : p.price, old: null };        // 'new'
}

/** The default discount for "−X %": what the catalogue really shows, else 25. */
function catalogueDiscount(p) {
  if (isBogoProduct(p) || !(p.commonPrice > p.price)) return 25;
  const d = Math.round((1 - p.price / p.commonPrice) * 100);
  return d >= 5 && d <= 90 ? d : 25;
}

/** Everything the renderer needs for one market. */
function buildBannerData(p, m) {
  const ph = PHRASES[m.cc];
  const e = dealPricesEUR(p, state.deal, state.pct);
  const fill = (s) => s.replace('{total}', e.total).replace('{buy}', e.buy);

  let deal, headline;
  if (/^\d+\+\d+$/.test(state.deal)) {
    deal = { kind: 'pack', big: state.deal, small: ph.free, ghost: state.deal };
    headline = state.deal === '1+1' ? ph.bogo : fill(ph.multi);
  } else if (state.deal === 'pct') {
    const big = formatPercent(state.pct, m.cc);
    deal = { kind: 'pct', big, small: ph.off, ghost: big.replace(/\s/g, '') };
    headline = ph.pct;
  } else if (state.deal === 'new') {
    deal = { kind: 'word', big: ph.newItem, ghost: '' };
    headline = ph.fresh;
  } else {
    deal = { kind: 'word', big: ph.sale, ghost: '%' };
    headline = ph.clear;
  }

  const now = convertPrice(e.now, m.cc);
  const old = e.old ? convertPrice(e.old, m.cc) : null;
  return {
    brand: m.brand,
    domain: m.domain,
    deal,
    headline: (state.heads[m.cc] || '').trim() || headline,
    name: (state.names[m.cc] || '').trim() || (state.names.sk || '').trim() || shortName(p.name),
    chips: specChips(p, m.cc),
    price: {
      now: formatPrice(now, m.cc),
      old: old && old > now ? formatPrice(old, m.cc) : null,
      note: e.total ? fill(ph.pack) : null,
    },
    cta: ph.cta,
  };
}

/** Technical facts as small chips: "30 W", "1 050 lm", "IP65", "2 400 K". */
function specChips(p, cc) {
  const c = [];
  if (p.watts) c.push(`${formatNumber(p.watts, cc)} W`);
  if (p.lumens) c.push(`${formatNumber(p.lumens, cc)} lm`);
  if (p.ip) c.push(`IP${p.ip}`);
  if (p.kelvin) c.push(`${formatNumber(p.kelvin, cc)} K`);
  return c.slice(0, 3);
}

/** Suggest a short banner name from a long catalogue name.
    "30W LED reflektor so senzorom SMD, SAMSUNG chip, biely, 1+1 zadarmo!"
    → "LED reflektor 30 W so senzorom"                                       */
function shortName(name) {
  let s = name
    .replace(/\[[^\]]*\]/g, '')                 // remove supplier codes [WOJ+14079]
    .replace(/1\s*\+\s*1\s*zadarmo!?/i, '')
    .split(',')[0]
    .replace(/\b(SMD|SAMSUNG chip|Forever Light)\b/gi, '')
    .replace(/(\d+(?:[.,]\d+)?)\s?W\b/g, '$1 W')  // 30W → 30 W
    .replace(/\s+/g, ' ')
    .trim();
  // "30 W LED reflektor …" reads better as "LED reflektor 30 W …"
  const m = s.match(/^(\d+(?:[.,]\d+)? W) (\S+ \S+)(.*)$/);
  if (m) s = `${m[2]} ${m[1]}${m[3]}`;
  // keep a useful second part if the first is very short ("Závesné svietidlo" is fine)
  if (s.length < 12 && name.split(',')[1]) s += ',' + name.split(',')[1];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ==========================================================================
   Previews
   ========================================================================== */
let currentPic = null;
let renderToken = 0;

/** Which banners exist right now, in display order. */
function bannerList() {
  const list = [];
  for (const f of FORMAT_ORDER) {
    if (!state.formats.has(f)) continue;
    for (const m of MARKETS) if (state.markets.has(m.cc)) list.push({ fmt: f, m, key: `${f}:${m.cc}` });
  }
  return list;
}

const fileName = (b) => `${b.fmt}-${state.product.code}-${b.m.cc}.png`;

async function renderPreviews() {
  if (!state.product) return;
  const token = ++renderToken;
  currentPic = await prepareImage('../../shared/' + state.product.image);
  if (token !== renderToken) return;              // a newer render already started

  const grid = $('#grid');
  grid.innerHTML = '';
  const list = bannerList();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const f of FORMAT_ORDER) {
    if (!state.formats.has(f) || (state.tab !== 'all' && state.tab !== f)) continue;
    const sec = document.createElement('section');
    sec.className = `fmt-group fmt-${f}`;
    sec.innerHTML = `<h3 class="fmt-title">${t('formats')[f]} <span class="muted">${FORMATS[f].w} × ${FORMATS[f].h}</span></h3><div class="fmt-grid"></div>`;
    const g = sec.querySelector('.fmt-grid');
    for (const b of list.filter(x => x.fmt === f)) {
      const card = document.createElement('article');
      card.className = 'tile';
      const canvas = document.createElement('canvas');
      // preview resolution: about as wide as the tile, sharp on retina
      const cssW = f === 'story' ? 220 : f === 'ig' ? 300 : 420;
      renderBanner(canvas, f, state.style, buildBannerData(state.product, b.m), currentPic, (cssW * dpr) / FORMATS[f].w);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${t('formats')[f]} – ${b.m.country}`);
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'tile-img';
      open.appendChild(canvas);
      open.addEventListener('click', () => openViewer(b.key));
      const starred = state.showcase.has(b.key);
      const meta = document.createElement('div');
      meta.className = 'tile-meta';
      meta.innerHTML = `
        <span class="cc">${b.m.lang}</span><span class="dom">${b.m.domain}</span>
        <button type="button" class="icon-btn star${starred ? ' on' : ''}" aria-pressed="${starred}" title="${t('toShowcase')}">★</button>
        <button type="button" class="icon-btn dl" title="${t('download')}" aria-label="${t('download')} ${fileName(b)}">↓</button>`;
      meta.querySelector('.star').addEventListener('click', (ev) => toggleStar(b.key, ev.currentTarget));
      meta.querySelector('.dl').addEventListener('click', () => downloadOne(b));
      card.append(open, meta);
      g.appendChild(card);
    }
    grid.appendChild(sec);
  }
  $('#status').textContent = t('status')(list.length);
  renderPriceTable();
}

function toggleStar(key, btn) {
  state.showcase.has(key) ? state.showcase.delete(key) : state.showcase.add(key);
  if (btn) { btn.classList.toggle('on', state.showcase.has(key)); btn.setAttribute('aria-pressed', state.showcase.has(key)); }
  $('#showcaseCount').textContent = state.showcase.size;
}

/* --- Full-size rendering and downloads ----------------------------------- */
function fullSizeBlob(b) {
  const c = document.createElement('canvas');
  renderBanner(c, b.fmt, state.style, buildBannerData(state.product, b.m), currentPic, 1);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function downloadOne(b) { saveBlob(await fullSizeBlob(b), fileName(b)); }

/** Pack a list of banners into a ZIP (folders per format). */
async function downloadZip(list, zipName) {
  const status = $('#status');
  if (!window.JSZip) {                                    // offline fallback
    status.textContent = t('noZip');
    for (const b of list) { await downloadOne(b); await new Promise(r => setTimeout(r, 250)); }
    return;
  }
  const zip = new JSZip();
  for (let i = 0; i < list.length; i++) {
    status.textContent = t('working')(i + 1, list.length);
    zip.folder(list[i].fmt).file(fileName(list[i]), await fullSizeBlob(list[i]));
    await new Promise(r => setTimeout(r));               // keep the page responsive
  }
  saveBlob(await zip.generateAsync({ type: 'blob' }), zipName);
  status.textContent = t('done')(list.length);
}

/* --- Large viewer --------------------------------------------------------- */
let viewerKey = null;
function openViewer(key) {
  const list = bannerList();
  const b = list.find(x => x.key === key) || list[0];
  if (!b) return;
  viewerKey = b.key;
  renderBanner($('#viewerCanvas'), b.fmt, state.style, buildBannerData(state.product, b.m), currentPic, 1);
  $('#viewerCanvas').className = 'fmt-' + b.fmt;
  $('#viewerTitle').textContent = `${t('formats')[b.fmt]} · ${b.m.lang}`;
  $('#viewerMeta').textContent = `${b.m.domain} · ${FORMATS[b.fmt].w} × ${FORMATS[b.fmt].h} px`;
  $('#viewerStar').checked = state.showcase.has(b.key);
  if (!$('#viewer').open) $('#viewer').showModal();
}
function stepViewer(dir) {
  const list = bannerList();
  const i = list.findIndex(x => x.key === viewerKey);
  openViewer(list[(i + dir + list.length) % list.length].key);
}

/* ==========================================================================
   Controls
   ========================================================================== */
function renderProductList() {
  const q = $('#search').value.trim().toLowerCase();
  const box = $('#productList');
  const items = state.products.filter(p => !q || `${p.name} ${p.category} ${p.code}`.toLowerCase().includes(q));
  box.innerHTML = items.length ? '' : `<p class="muted small pad">${t('noResults')}</p>`;
  for (const p of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'product' + (state.product && p.code === state.product.code ? ' on' : '');
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', state.product && p.code === state.product.code);
    b.innerHTML = `<img src="../../shared/${p.image}" alt="" loading="lazy" width="44" height="44">
      <span class="p-text"><span class="p-name"></span><span class="p-meta muted">${p.code} · ${formatPrice(p.price, 'sk')}</span></span>`;
    b.querySelector('.p-name').textContent = p.name;
    b.addEventListener('click', () => selectProduct(p));
    box.appendChild(b);
  }
}

function selectProduct(p, keepNames) {
  state.product = p;
  if (!keepNames) {
    state.names = {};
    state.heads = {};
    $('#nameSk').value = shortName(p.name);
    state.names.sk = $('#nameSk').value;
  }
  if (state.deal === 'pct') { state.pct = catalogueDiscount(p); $('#pct').value = state.pct; }
  renderProductList();
  renderLocTable();
  renderPreviews();
}

function renderDealChips() {
  const box = $('#dealChips');
  box.innerHTML = '';
  for (const d of DEAL_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.deal === d ? ' on' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', state.deal === d);
    b.textContent = t('deals')[d];
    b.addEventListener('click', () => {
      state.deal = d;
      if (d === 'pct' && state.product) { state.pct = catalogueDiscount(state.product); $('#pct').value = state.pct; }
      renderDealChips(); renderLocTable(); renderPreviews();
    });
    box.appendChild(b);
  }
  $('#pctRow').hidden = state.deal !== 'pct';
}

/** Small colour swatch for each style, so you can see it before choosing. */
const SWATCH = {
  amber: 'radial-gradient(circle at 70% 55%, #f6a540 0, #7a3f12 35%, #120d09 70%)',
  clean: 'radial-gradient(circle at 70% 55%, #fde2ba 0, #fbfaf7 60%)',
  bold:  'linear-gradient(135deg, #ffc43d 60%, #14110c 60%)',
  night: 'radial-gradient(circle at 70% 55%, #4f7fd0 0, #0d1830 45%, #060a15 80%)',
};
function renderStyleCards() {
  const box = $('#styleCards');
  box.innerHTML = '';
  for (const s of STYLE_ORDER) {
    const [name, desc] = t('styles')[s];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'style-card' + (state.style === s ? ' on' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', state.style === s);
    b.innerHTML = `<span class="sw" style="background:${SWATCH[s]}"></span><span><b>${name}</b><span class="muted">${desc}</span></span>`;
    b.addEventListener('click', () => { state.style = s; renderStyleCards(); renderPreviews(); });
    box.appendChild(b);
  }
}

function renderLocTable() {
  const box = $('#locTable');
  box.innerHTML = `<div class="loc-row loc-head"><span></span><span>${t('colName')}</span><span>${t('colHead')}</span></div>`;
  for (const m of MARKETS) {
    const row = document.createElement('div');
    row.className = 'loc-row';
    const def = state.product ? buildBannerData(state.product, m) : null;
    row.innerHTML = `<span class="cc" title="${m.country}">${m.lang}</span>
      <input type="text" data-k="names" aria-label="${m.country} – ${t('colName')}">
      <input type="text" data-k="heads" aria-label="${m.country} – ${t('colHead')}">`;
    const [inName, inHead] = row.querySelectorAll('input');
    inName.value = state.names[m.cc] || state.names.sk || '';
    inHead.value = state.heads[m.cc] || '';
    inHead.placeholder = def ? defaultHeadline(m) : '';
    if (m.cc === 'sk') inName.disabled = true;           // SK is edited in the field above
    for (const inp of [inName, inHead]) {
      inp.addEventListener('input', () => { state[inp.dataset.k][m.cc] = inp.value; debounceRender(); });
    }
    box.appendChild(row);
  }
}
function defaultHeadline(m) {
  const saved = state.heads[m.cc]; state.heads[m.cc] = '';
  const h = buildBannerData(state.product, m).headline;
  state.heads[m.cc] = saved; return h;
}

function renderChecks() {
  const fBox = $('#formatChecks'), mBox = $('#marketChecks');
  fBox.innerHTML = ''; mBox.innerHTML = '';
  for (const f of FORMAT_ORDER) {
    fBox.appendChild(check(t('formats')[f], state.formats.has(f), on => { on ? state.formats.add(f) : state.formats.delete(f); renderTabs(); renderPreviews(); }));
  }
  for (const m of MARKETS) {
    mBox.appendChild(check(m.lang, state.markets.has(m.cc), on => { on ? state.markets.add(m.cc) : state.markets.delete(m.cc); renderPreviews(); }, m.country));
  }
}
function check(label, on, cb, title) {
  const l = document.createElement('label');
  l.className = 'check';
  if (title) l.title = title;
  l.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''}> <span></span>`;
  l.querySelector('span').textContent = label;
  l.querySelector('input').addEventListener('change', e => cb(e.target.checked));
  return l;
}

function renderTabs() {
  const box = $('#formatTabs');
  box.innerHTML = '';
  for (const f of ['all', ...FORMAT_ORDER.filter(x => state.formats.has(x))]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.className = 'tab' + (state.tab === f ? ' on' : '');
    b.setAttribute('aria-selected', state.tab === f);
    b.textContent = f === 'all' ? t('all') : t('formats')[f];
    b.addEventListener('click', () => { state.tab = f; renderTabs(); renderPreviews(); });
    box.appendChild(b);
  }
}

function renderPriceTable() {
  const p = state.product;
  if (!p) return;
  const e = dealPricesEUR(p, state.deal, state.pct);
  $('#priceTable').innerHTML = MARKETS.map(m => {
    const now = convertPrice(e.now, m.cc), old = e.old ? convertPrice(e.old, m.cc) : null;
    return `<div class="pr-row"><span class="cc">${m.lang}</span><span class="pr-rule muted">${PRICE_RULES[m.cc].rule}</span>
      <span class="pr-val">${old && old > now ? `<s>${formatPrice(old, m.cc)}</s> ` : ''}<b>${formatPrice(now, m.cc)}</b></span></div>`;
  }).join('');
}

/* --- Interface language -------------------------------------------------- */
function applyUiLang(lang) {
  state.ui = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem('bannerovac-ui', lang); } catch (e) { /* private mode – fine */ }
  document.querySelectorAll('[data-ui-lang]').forEach(b => b.classList.toggle('on', b.dataset.uiLang === lang));
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  renderDealChips(); renderStyleCards(); renderChecks(); renderTabs(); renderProductList(); renderLocTable();
  renderPreviews();
}

let debounceTimer;
function debounceRender() { clearTimeout(debounceTimer); debounceTimer = setTimeout(renderPreviews, 250); }

/* --- The "Kampaň" preset: a ready showcase set ---------------------------- */
function runCampaign() {
  const p = state.products.find(x => x.code === '458');
  if (!p) return;
  Object.assign(state, { deal: '1+1', style: 'amber', tab: 'all', formats: new Set(FORMAT_ORDER), markets: new Set(MARKETS.map(m => m.cc)) });
  state.names = { ...CAMPAIGN_NAMES['458'] };
  state.heads = {};
  $('#nameSk').value = state.names.sk;
  state.showcase = new Set([...MARKETS.map(m => `ig:${m.cc}`), 'hero:sk']);
  $('#showcaseCount').textContent = state.showcase.size;
  renderDealChips(); renderStyleCards(); renderChecks(); renderTabs();
  selectProduct(p, true);
  $('#status').textContent = t('campaignDone');
  setTimeout(() => { $('#status').textContent = t('campaignDone'); }, 400);
  document.querySelector('.previews').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ==========================================================================
   Start-up
   ========================================================================== */

/** Canvas can only use fonts that are already downloaded – so we ask for
    every weight we draw with (incl. Polish/Hungarian/Romanian letters). */
async function loadFonts() {
  const sample = 'AaŽžČčŁłŐőŰűȚțĂăŞşĆćĐđ€0123456789+−%';
  const faces = ['500', '600', '700', '800', '900'].map(w => `${w} 40px Inter`)
    .concat(['600 40px Fraunces', '700 40px Fraunces']);
  try { await Promise.all(faces.map(f => document.fonts.load(f, sample))); } catch (e) { /* offline → system fonts */ }
  await document.fonts.ready;
}

async function loadProducts() {
  const res = await fetch('../../shared/products.json');
  const list = await res.json();
  return list.map(p => ({ ...p, code: String(p.code) }));
}

/* Hidden export mode used to make the portfolio images with headless Chrome:
   ?export=ig&code=458&deal=1+1&style=amber&cc=sk[&campaign=1][&pct=25]
   It draws one full-size banner and writes it as a data-URL into <pre>.   */
async function exportMode(params) {
  document.body.innerHTML = '<pre id="export-out"></pre>';
  await loadFonts();
  const products = await loadProducts();
  const p = products.find(x => x.code === params.get('code')) || products[0];
  state.deal = params.get('deal') || '1+1';
  state.pct = Number(params.get('pct')) || catalogueDiscount(p);
  state.style = params.get('style') || 'amber';
  state.product = p;
  state.names = params.get('campaign') && CAMPAIGN_NAMES[p.code] ? { ...CAMPAIGN_NAMES[p.code] } : { sk: params.get('name') || shortName(p.name) };
  const m = MARKETS.find(x => x.cc === (params.get('cc') || 'sk'));
  const pic = await prepareImage('../../shared/' + p.image);
  const c = renderBanner(document.createElement('canvas'), params.get('export'), state.style, buildBannerData(p, m), pic, 1);
  $('#export-out').textContent = c.toDataURL('image/png');
  document.title = 'export-done';
}

async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get('export')) return exportMode(params);

  let saved = 'sk';
  try { saved = localStorage.getItem('bannerovac-ui') || 'sk'; } catch (e) { /* ignore */ }
  state.ui = saved === 'en' ? 'en' : 'sk';
  $('#status').textContent = t('loading');

  try {
    await loadFonts();
    state.products = await loadProducts();
  } catch (e) {
    $('#status').textContent = t('loadError');
    return;
  }

  // events
  document.querySelectorAll('[data-ui-lang]').forEach(b => b.addEventListener('click', () => applyUiLang(b.dataset.uiLang)));
  $('#search').addEventListener('input', renderProductList);
  $('#pct').addEventListener('input', () => {
    state.pct = Math.min(90, Math.max(1, Number($('#pct').value) || 0));
    renderLocTable(); debounceRender();
  });
  $('#nameSk').addEventListener('input', () => {
    state.names.sk = $('#nameSk').value;
    renderLocTable(); debounceRender();
  });
  $('#copySk').addEventListener('click', () => {
    for (const m of MARKETS) state.names[m.cc] = state.names.sk;
    renderLocTable(); renderPreviews();
  });
  $('#campaignBtn').addEventListener('click', runCampaign);
  $('#zipBtn').addEventListener('click', () => downloadZip(bannerList(), `bannerovac-${state.product.code}-${state.deal.replace('+', 'plus')}-${state.style}.zip`));
  $('#showcaseBtn').addEventListener('click', () => {
    const all = MARKETS.flatMap(m => FORMAT_ORDER.map(f => ({ fmt: f, m, key: `${f}:${m.cc}` })));
    const list = all.filter(b => state.showcase.has(b.key));
    if (!list.length) { $('#status').textContent = t('nothingStarred'); return; }
    downloadZip(list, `showcase-${state.product.code}.zip`);
  });
  $('#viewerClose').addEventListener('click', () => $('#viewer').close());
  $('#viewer').addEventListener('click', e => { if (e.target.id === 'viewer') $('#viewer').close(); });
  $('#viewerPrev').addEventListener('click', () => stepViewer(-1));
  $('#viewerNext').addEventListener('click', () => stepViewer(1));
  $('#viewer').addEventListener('keydown', e => { if (e.key === 'ArrowLeft') stepViewer(-1); if (e.key === 'ArrowRight') stepViewer(1); });
  $('#viewerDownload').addEventListener('click', () => { const b = bannerList().find(x => x.key === viewerKey); if (b) downloadOne(b); });
  $('#viewerStar').addEventListener('change', () => { toggleStar(viewerKey); renderPreviews(); });

  // start with the campaign product so the page never looks empty
  state.product = state.products.find(p => p.code === '458') || state.products[0];
  $('#nameSk').value = shortName(state.product.name);
  state.names.sk = $('#nameSk').value;
  applyUiLang(state.ui);
}

init();
