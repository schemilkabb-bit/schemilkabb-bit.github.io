/* ==========================================================================
   Bannerovač – markets.js
   Everything that changes from country to country lives here:
   shop names and domains, currencies and price rounding, and the
   marketing phrases written into the banners (deal names, headlines, CTA).

   The phrases were written by hand for each language – no machine translation.
   ========================================================================== */

/* --- 1) The 8 shops of the LEDAKCIA network ------------------------------ */
/* `locale` is used by Intl.NumberFormat so numbers look the way locals write
   them (decimal comma, space or dot as thousands separator …).
   `money` says where the currency symbol goes – {n} is the number.          */
const MARKETS = [
  { cc: 'sk', lang: 'SK', country: 'Slovensko', brand: 'LEDakcia',   domain: 'ledakcia.sk',     locale: 'sk-SK', currency: 'EUR', money: '{n} €'   },
  { cc: 'cz', lang: 'CZ', country: 'Česko',     brand: 'LEDakce',    domain: 'ledakce.cz',      locale: 'cs-CZ', currency: 'CZK', money: '{n} Kč'  },
  { cc: 'pl', lang: 'PL', country: 'Polska',    brand: 'LEDakcja',   domain: 'ledakcja.pl',     locale: 'pl-PL', currency: 'PLN', money: '{n} zł'  },
  { cc: 'at', lang: 'DE', country: 'Österreich',brand: 'LEDaktion',  domain: 'ledaktion.co.at', locale: 'de-AT', currency: 'EUR', money: '€ {n}'   },
  { cc: 'hr', lang: 'HR', country: 'Hrvatska',  brand: 'LEDakcija',  domain: 'ledakcija.hr',    locale: 'hr-HR', currency: 'EUR', money: '{n} €'   },
  { cc: 'si', lang: 'SI', country: 'Slovenija', brand: 'LEDakcija',  domain: 'ledakcija.si',    locale: 'sl-SI', currency: 'EUR', money: '{n} €'   },
  { cc: 'hu', lang: 'HU', country: 'Magyarország', brand: 'LEDjoaron', domain: 'ledjoaron.hu',  locale: 'hu-HU', currency: 'HUF', money: '{n} Ft'  },
  { cc: 'ro', lang: 'RO', country: 'România',   brand: 'LEDpromotia',domain: 'ledpromotia.ro',  locale: 'ro-RO', currency: 'RON', money: '{n} lei' },
];

/* --- 2) Price conversion with "marketing rounding" ------------------------
   The catalogue holds Slovak prices in EUR. Each shop shows its own price
   point that ends the way shoppers expect (…9 Kč, …,99 zł, …90 Ft).
   Checked against the live shops: 49,99 € = 1 299 Kč = 229,99 zł.           */
const PRICE_RULES = {
  sk: { rule: 'EUR 1 : 1',               convert: eur => eur,                         decimals: 2 },
  at: { rule: 'EUR 1 : 1',               convert: eur => eur,                         decimals: 2 },
  si: { rule: 'EUR 1 : 1',               convert: eur => eur,                         decimals: 2 },
  hr: { rule: 'EUR +2 % → …,99',         convert: eur => endIn99(eur * 1.02),         decimals: 2 },
  cz: { rule: '× 26 → …9 Kč',            convert: eur => endIn9(eur * 26),            decimals: 0 },
  pl: { rule: '× 4,6 → …,99 zł',         convert: eur => endIn99(eur * 4.6),          decimals: 2 },
  hu: { rule: '× 400 → …90 Ft',          convert: eur => endIn90(eur * 400),          decimals: 0 },
  ro: { rule: '× 5 → …,99 lei',          convert: eur => endIn99(eur * 5),            decimals: 2 },
};

// 229,95 → 229,99   (round to whole number, then go one cent below it)
function endIn99(x) { return Math.max(0.99, Math.round(x) - 0.01); }
// 1 299,74 → 1 299  (round to tens, then one crown below)
function endIn9(x)  { return Math.max(9, Math.round(x / 10) * 10 - 1); }
// 19 996 → 19 990   (round to hundreds, then ten forints below)
function endIn90(x) { return Math.max(90, Math.round(x / 100) * 100 - 10); }

/** Convert a Slovak EUR price to the shop's own price point. */
function convertPrice(eur, cc) {
  return PRICE_RULES[cc].convert(eur);
}

/** Format a price the way people in that country write it, e.g. "1 299 Kč". */
function formatPrice(value, cc) {
  const m = MARKETS.find(x => x.cc === cc);
  const d = PRICE_RULES[cc].decimals;
  const n = new Intl.NumberFormat(m.locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  // Non-breaking space so "1 299" and "Kč" never split onto two lines.
  return m.money.replace('{n}', n).replace(' ', ' ');
}

/** Format any plain number for a market (used for lumens, watts, kelvin). */
function formatNumber(value, cc) {
  const m = MARKETS.find(x => x.cc === cc);
  return new Intl.NumberFormat(m.locale, { maximumFractionDigits: 1 }).format(value);
}

/** "−25 %" with the locale's own spacing and a real typographic minus. */
function formatPercent(pct, cc) {
  const m = MARKETS.find(x => x.cc === cc);
  const s = new Intl.NumberFormat(m.locale, { style: 'percent' }).format(pct / 100);
  return '−' + s.replace(/^[-−]/, '');
}

/* --- 3) Banner phrases per language ----------------------------------------
   Keyed by shop (cc). {buy} and {total} are filled in for multi-packs.      */
const PHRASES = {
  //            "free" word   discount word  new           clearance            CTA               pack note                 multi-pack headline                1+1 headline                 −X % headline                new headline          clearance headline
  sk: { free: 'zadarmo',  off: 'zľava',      newItem: 'Novinka',   sale: 'Výpredaj',          cta: 'Kúpiť teraz',   pack: 'za {total} ks',    multi: '{total} ks za cenu {buy}',     bogo: 'Druhý kus dostanete zadarmo', pct: 'Akcia len na krátky čas', fresh: 'Práve v ponuke',    clear: 'Do vypredania zásob' },
  cz: { free: 'zdarma',   off: 'sleva',      newItem: 'Novinka',   sale: 'Výprodej',          cta: 'Koupit nyní',   pack: 'za {total} ks',    multi: '{total} ks za cenu {buy}',     bogo: 'Druhý kus dostanete zdarma',  pct: 'Akce jen na krátkou dobu', fresh: 'Právě v nabídce', clear: 'Do vyprodání zásob' },
  pl: { free: 'gratis',   off: 'rabatu',     newItem: 'Nowość',    sale: 'Wyprzedaż',         cta: 'Kup teraz',     pack: 'za {total} szt.',  multi: '{total} szt. w cenie {buy}',   bogo: 'Druga sztuka gratis',         pct: 'Promocja tylko przez chwilę', fresh: 'Już w sprzedaży', clear: 'Do wyczerpania zapasów' },
  at: { free: 'gratis',   off: 'Rabatt',     newItem: 'Neu',       sale: 'Abverkauf',         cta: 'Jetzt kaufen',  pack: 'für {total} Stück',multi: '{total} Stück zum Preis von {buy}', bogo: 'Das zweite Stück gratis', pct: 'Nur für kurze Zeit',     fresh: 'Jetzt neu im Shop', clear: 'Solange der Vorrat reicht' },
  hr: { free: 'gratis',   off: 'popusta',    newItem: 'Novo',      sale: 'Rasprodaja',        cta: 'Kupi sada',     pack: 'za {total} kom.',  multi: '{total} kom. po cijeni {buy}', bogo: 'Drugi komad poklanjamo',      pct: 'Samo kratko vrijeme',    fresh: 'Upravo stiglo',     clear: 'Do isteka zaliha' },
  si: { free: 'gratis',   off: 'popusta',    newItem: 'Novo',      sale: 'Razprodaja',        cta: 'Kupi zdaj',     pack: 'za {total} kos.',  multi: '{total} kos. za ceno {buy}',   bogo: 'Drugi kos vam podarimo',      pct: 'Samo za kratek čas',     fresh: 'Pravkar prispelo',  clear: 'Do razprodaje zalog' },
  hu: { free: 'ingyen',   off: 'kedvezmény', newItem: 'Újdonság',  sale: 'Kiárusítás',        cta: 'Vásárolj most', pack: '{total} db ára',   multi: '{total} db {buy} áráért',      bogo: 'A második darab ajándék',     pct: 'Csak rövid ideig',       fresh: 'Most érkezett',     clear: 'Amíg a készlet tart' },
  ro: { free: 'gratuit',  off: 'reducere',   newItem: 'Noutate',   sale: 'Lichidare de stoc', cta: 'Cumpără acum',  pack: 'pentru {total} buc.', multi: '{total} buc. la preț de {buy}', bogo: 'Al doilea produs cadou',  pct: 'Doar pentru scurt timp', fresh: 'Tocmai a sosit',    clear: 'În limita stocului' },
};

/* --- 4) Campaign phrasebook ------------------------------------------------
   Product names are NOT translated automatically (the tool runs offline,
   without AI). For the showcase campaign Emília wrote the names herself.   */
const CAMPAIGN_NAMES = {
  '458': {
    sk: 'LED reflektor 30 W so senzorom',
    cz: 'LED reflektor 30 W se senzorem',
    pl: 'Naświetlacz LED 30 W z czujnikiem ruchu',
    at: 'LED-Strahler 30 W mit Bewegungsmelder',
    hr: 'LED reflektor 30 W sa senzorom',
    si: 'LED reflektor 30 W s senzorjem',
    hu: 'LED reflektor 30 W mozgásérzékelővel',
    ro: 'Proiector LED 30 W cu senzor',
  },
};
