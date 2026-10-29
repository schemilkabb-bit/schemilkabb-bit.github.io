/* ==========================================================================
   Bannerovač – render.js
   Draws one banner onto a <canvas>. No libraries: plain Canvas 2D, so the
   output is crisp at any size and the same code makes previews and the
   final PNG files.

   How a banner is built:
     1. paint the background of the chosen visual style
     2. place the product photo (on a card, or blended into a light background)
     3. place the texts in "stacks" (columns). Every text is measured first;
        if a column would overflow, everything in it shrinks a little and is
        measured again – so text can never run out of the banner.
   ========================================================================== */

const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const DISPLAY = '"Fraunces", Georgia, "Times New Roman", serif';

/* --- Formats ------------------------------------------------------------ */
const FORMATS = {
  hero:  { id: 'hero',  w: 1200, h: 400  },
  ig:    { id: 'ig',    w: 1080, h: 1080 },
  story: { id: 'story', w: 1080, h: 1920 },
  fb:    { id: 'fb',    w: 1200, h: 628  },
};

/* --- Layouts: where things go in each format ------------------------------
   Every number is in real banner pixels. A "stack" is a column of items
   drawn top-to-bottom; [item, max font size, extra options].              */
const LAYOUTS = {
  ig: {
    logo:   { x: 72, y: 84, size: 38, align: 'left' },
    domain: { x: 1008, y: 84, size: 24, align: 'right' },
    product:{ x: 500, y: 168, w: 508, h: 590 },
    stacks: [
      { x: 72, y: 168, w: 400, h: 590, align: 'left', valign: 'center', gap: 32,
        items: [['deal', 240], ['headline', 58, { lines: 2 }], ['name', 29, { lines: 2 }], ['chips', 23]] },
      { x: 72, y: 806, w: 936, h: 202, align: 'left', valign: 'bottom',
        items: [['buy', 104, { cta: 32 }]] },
    ],
  },
  story: {
    logo:   { x: 540, y: 190, size: 46, align: 'center' },
    domain: { x: 540, y: 1730, size: 30, align: 'center' },
    product:{ x: 150, y: 790, w: 780, h: 540 },
    stacks: [
      { x: 90, y: 260, w: 900, h: 490, align: 'center', valign: 'center', gap: 40,
        items: [['deal', 300], ['headline', 76, { lines: 2 }]] },
      { x: 90, y: 1370, w: 900, h: 300, align: 'center', valign: 'top', gap: 30,
        items: [['name', 36, { lines: 2 }], ['price', 120], ['cta', 38]] },
    ],
  },
  fb: {
    logo:   { x: 56, y: 62, size: 30, align: 'left' },
    domain: { x: 1144, y: 62, size: 20, align: 'right' },
    product:{ x: 650, y: 108, w: 494, h: 464 },
    stacks: [
      { x: 56, y: 112, w: 550, h: 300, align: 'left', valign: 'top', gap: 20,
        items: [['deal', 150, { inline: true }], ['headline', 44, { lines: 2 }], ['name', 22, { lines: 2 }]] },
      { x: 56, y: 430, w: 570, h: 142, align: 'left', valign: 'bottom',
        items: [['buy', 70, { cta: 22 }]] },
    ],
  },
  hero: {
    logo:   { x: 40, y: 46, size: 26, align: 'left' },
    domain: { x: 1160, y: 46, size: 17, align: 'right' },
    product:{ x: 600, y: 30, w: 320, h: 340 },
    stacks: [
      { x: 40, y: 84, w: 530, h: 286, align: 'left', valign: 'center', gap: 14,
        items: [['deal', 112, { inline: true }], ['headline', 38, { lines: 2 }], ['name', 19, { lines: 1 }]] },
      { x: 950, y: 84, w: 210, h: 286, align: 'left', valign: 'center', gap: 18,
        items: [['price', 64], ['cta', 19]] },
    ],
  },
};

/* --- Visual styles ----------------------------------------------------------
   Each style is a set of colours/fonts plus its own background painter.
   `product: 'card'`  → product sits on a light card (good on dark styles)
   `product: 'blend'` → white photo background melts into the page (multiply) */
const STYLES = {
  amber: {
    dark: true, product: 'card', cardFill: '#fff6e8',
    glow: 'rgba(255,164,60,0.55)', cardShadow: 'rgba(255,170,70,0.65)',
    ink: '#fbf1e2', soft: '#cdbfa9', muted: '#a8987f',
    logoInk: '#fbf1e2', logoDot: '#ffb04a',
    dealFont: [DISPLAY, 700], headFont: [DISPLAY, 600], priceFont: [DISPLAY, 700],
    dealFill: (ctx, y, h) => vGrad(ctx, y, h, ['#ffe6b3', '#f6a540', '#e3832a']),
    badgeBg: '#f2a33a', badgeInk: '#1a1206',
    chipBg: 'rgba(255,214,150,0.08)', chipLine: 'rgba(255,214,150,0.35)', chipInk: '#f3dfbf',
    priceInk: '#ffc46b', oldInk: '#a8987f',
    ctaBg: '#f2a33a', ctaInk: '#1a1206',
    paint: paintAmber,
  },
  clean: {
    dark: false, product: 'blend',
    glow: 'rgba(253,214,160,0.9)',
    ink: '#1d2230', soft: '#4f5668', muted: '#7a8090',
    logoInk: '#1d2230', logoDot: '#e0952d',
    dealFont: [DISPLAY, 700], headFont: [DISPLAY, 600], priceFont: [DISPLAY, 700],
    dealFill: () => '#1d2230',
    badgeBg: '#e39a33', badgeInk: '#1d1405',
    chipBg: '#ffffff', chipLine: '#e2ddd3', chipInk: '#3d4456',
    priceInk: '#1d2230', oldInk: '#7a8090',
    ctaBg: '#1d2230', ctaInk: '#ffffff',
    paint: paintClean,
  },
  bold: {
    dark: false, product: 'card', cardFill: '#ffffff', cardOutline: '#14110c',
    glow: null,
    ink: '#14110c', soft: '#3a2f1c', muted: '#5a4a2c',
    logoInk: '#14110c', logoDot: '#14110c',
    dealFont: [SANS, 900], headFont: [SANS, 800], priceFont: [SANS, 900],
    dealFill: () => '#14110c',
    badgeBg: '#14110c', badgeInk: '#ffc43d',
    chipBg: 'rgba(20,17,12,0.06)', chipLine: '#14110c', chipInk: '#14110c',
    priceInk: '#14110c', oldInk: 'rgba(20,17,12,0.62)',
    ctaBg: '#14110c', ctaInk: '#ffffff',
    paint: paintBold,
  },
  night: {
    dark: true, product: 'card', cardFill: '#f3f7ff',
    glow: 'rgba(140,190,255,0.42)', cardShadow: 'rgba(150,200,255,0.6)',
    ink: '#ffffff', soft: '#b9c6dc', muted: '#8d9cb8',
    logoInk: '#ffffff', logoDot: '#ffd27a',
    dealFont: [DISPLAY, 700], headFont: [DISPLAY, 600], priceFont: [SANS, 800],
    dealFill: (ctx, y, h) => vGrad(ctx, y, h, ['#fff4d6', '#ffd27a']),
    dealGlow: 'rgba(255,210,122,0.45)',
    badgeBg: '#ffd27a', badgeInk: '#0b1222',
    chipBg: 'rgba(160,200,255,0.08)', chipLine: 'rgba(160,200,255,0.35)', chipInk: '#d8e4f7',
    priceInk: '#ffffff', oldInk: '#8d9cb8',
    ctaBg: '#ffd27a', ctaInk: '#0b1222',
    paint: paintNight,
  },
};

/* ==========================================================================
   Backgrounds
   ========================================================================== */
function paintAmber(ctx, W, H, focus) {
  ctx.fillStyle = '#120d09';
  ctx.fillRect(0, 0, W, H);
  // big warm light behind the product
  radial(ctx, focus.x, focus.y, Math.max(W, H) * 0.75, [[0, 'rgba(255,160,60,0.42)'], [0.35, 'rgba(214,110,30,0.16)'], [1, 'rgba(0,0,0,0)']]);
  // a second, softer glow in the opposite corner keeps the text side alive
  radial(ctx, W * 0.05, H * 0.0, Math.max(W, H) * 0.6, [[0, 'rgba(255,190,110,0.10)'], [1, 'rgba(0,0,0,0)']]);
  vignette(ctx, W, H, 0.55);
}

function paintClean(ctx, W, H, focus) {
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, W, H);
  radial(ctx, focus.x, focus.y, Math.max(W, H) * 0.55, [[0, 'rgba(253,226,186,0.9)'], [0.5, 'rgba(252,236,212,0.45)'], [1, 'rgba(251,250,247,0)']]);
  // thin amber rule along the bottom edge – a quiet brand accent
  ctx.fillStyle = '#e39a33';
  ctx.fillRect(0, H - Math.round(H * 0.012 + 3), W, Math.round(H * 0.012 + 3));
}

function paintBold(ctx, W, H, focus, data) {
  ctx.fillStyle = '#ffc43d';
  ctx.fillRect(0, 0, W, H);
  // giant ghost text of the deal in the background – the "big type" look
  if (data.deal.ghost) {
    ctx.save();
    ctx.translate(W * 0.5, H * 0.52);
    ctx.rotate(-0.12);
    ctx.font = `900 ${Math.min(W, H) * 0.95}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(data.deal.ghost, 0, 0);
    ctx.restore();
  }
  // diagonal stripes in the corner
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.strokeStyle = 'rgba(20,17,12,0.08)';
  ctx.lineWidth = Math.max(W, H) * 0.012;
  for (let i = 0; i < 9; i++) {
    const o = Math.max(W, H) * (0.9 + i * 0.035);
    ctx.beginPath(); ctx.moveTo(o, H + 10); ctx.lineTo(o + H * 1.2, -10 - H * 0.0); ctx.stroke();
  }
  ctx.restore();
}

function paintNight(ctx, W, H, focus) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#060a15'); g.addColorStop(0.65, '#0d1830'); g.addColorStop(1, '#16274a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // stars – a fixed random seed so every banner gets the same sky
  const rnd = seededRandom(7);
  const n = Math.round((W * H) / 9000);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H * 0.8, r = rnd() * 1.6 + 0.4;
    ctx.globalAlpha = 0.25 + rnd() * 0.6 * (1 - y / H);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  radial(ctx, focus.x, focus.y, Math.max(W, H) * 0.6, [[0, 'rgba(120,175,255,0.34)'], [0.4, 'rgba(80,130,220,0.12)'], [1, 'rgba(0,0,0,0)']]);
  // a warm "light on the ground" at the bottom
  radial(ctx, W * 0.5, H * 1.1, Math.max(W, H) * 0.7, [[0, 'rgba(255,200,120,0.18)'], [1, 'rgba(0,0,0,0)']]);
}

/* ==========================================================================
   Product image
   ========================================================================== */

/** Load a product photo and study it once: does it have a white background?
    Where is the product (trim box)? Where is the brightest light (focus)? */
const imageCache = new Map();
function prepareImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(analyseImage(img, url));
    img.onerror = reject;
    img.src = url;
  });
  imageCache.set(url, p);
  return p;
}

function analyseImage(img, url) {
  const W = img.naturalWidth, H = img.naturalHeight;
  // work on a small copy – fast and good enough to analyse
  const s = Math.min(1, 220 / Math.max(W, H));
  const w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  const px = cx.getImageData(0, 0, w, h).data;
  const at = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  const isWhite = ([r, g, b, a]) => a < 20 || (r > 236 && g > 236 && b > 236);
  const isPaper = ([r, g, b, a]) => a < 20 || (r > 249 && g > 249 && b > 249);   // stricter, for trimming

  // 1) Sample a ring 5 % inside the edges (rounded photo corners are white too).
  let white = 0, total = 0;
  const ix = Math.round(w * 0.05), iy = Math.round(h * 0.05);
  for (let t = 0; t <= 1.0001; t += 0.05) {
    for (const [x, y] of [[ix + t * (w - 2 * ix), iy], [ix + t * (w - 2 * ix), h - 1 - iy], [ix, iy + t * (h - 2 * iy)], [w - 1 - ix, iy + t * (h - 2 * iy)]]) {
      total++; if (isWhite(at(Math.round(x), Math.round(y)))) white++;
    }
  }
  const cutout = white / total > 0.8;

  // 2) Photos with "_1PLUS1" already have big "1+1 GRATIS" text baked into the
  //    bottom third. We crop it away – the banner says it better, per language.
  const bakedText = /_1PLUS1/i.test(url);
  let box;
  if (cutout) {
    // trim box = smallest rectangle that holds all non-white pixels
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!isPaper(at(x, y))) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    const m = 2;
    box = { sx: Math.max(0, x0 - m) / s, sy: Math.max(0, y0 - m) / s, sw: (Math.min(w - 1, x1 + m) - Math.max(0, x0 - m) + 1) / s, sh: (Math.min(h - 1, y1 + m) - Math.max(0, y0 - m) + 1) / s };
  } else {
    box = { sx: W * 0.025, sy: H * 0.025, sw: W * 0.95, sh: H * (bakedText ? 0.66 : 0.95) };
  }

  // 3) Focus = centre of the brightest pixels (on LED photos that's the light).
  let fx = 0, fy = 0, fw = 0;
  for (let y = Math.round(box.sy * s); y < Math.round((box.sy + box.sh) * s); y++) {
    for (let x = Math.round(box.sx * s); x < Math.round((box.sx + box.sw) * s); x++) {
      const [r, g, b] = at(x, y);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const wgt = Math.max(0, lum - 200) ** 2;
      fx += x * wgt; fy += y * wgt; fw += wgt;
    }
  }
  let focus = { x: 0.5, y: 0.5 };
  if (fw > 0 && !cutout) {
    const bx = (fx / fw / s - box.sx) / box.sw, by = (fy / fw / s - box.sy) / box.sh;
    focus = { x: 0.5 + (bx - 0.5) * 0.75, y: 0.5 + (by - 0.5) * 0.75 };   // lean towards the light, not all the way
  }
  return { img, cutout, box, focus };
}

/** Draw the product into the layout's product slot, in the style's way. */
function drawProduct(ctx, S, pic, r) {
  if (!pic) return;
  const { img, box } = pic;

  if (pic.cutout && S.product === 'blend') {
    // Light style: let the white photo background disappear into the page.
    const fit = contain(box.sw, box.sh, r.w * 0.9, r.h * 0.86);
    const x = r.x + (r.w - fit.w) / 2, y = r.y + (r.h - fit.h) / 2 - r.h * 0.02;
    // a soft warm disc behind and a floor shadow under the product
    radial(ctx, r.x + r.w / 2, r.y + r.h * 0.48, Math.min(r.w, r.h) * 0.55, [[0, 'rgba(255,214,160,0.75)'], [0.7, 'rgba(255,226,190,0.35)'], [1, 'rgba(255,240,220,0)']]);
    ctx.save();
    ctx.translate(r.x + r.w / 2, y + fit.h + r.h * 0.015);
    ctx.scale(1, 0.12);
    radial(ctx, 0, 0, fit.w * 0.45, [[0, 'rgba(29,34,48,0.30)'], [1, 'rgba(29,34,48,0)']]);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(img, box.sx, box.sy, box.sw, box.sh, x, y, fit.w, fit.h);
    ctx.restore();
    return;
  }

  // Card or photo frame: work out the frame first.
  let frame, inner;
  if (pic.cutout) {
    const pad = Math.min(r.w, r.h) * 0.09;
    const fit = contain(box.sw, box.sh, r.w - 2 * pad, r.h - 2 * pad);
    let fw = fit.w + 2 * pad, fh = fit.h + 2 * pad;
    fw = Math.min(r.w, Math.max(fw, fh * 0.82));          // avoid very thin cards
    fh = Math.min(r.h, Math.max(fh, fw * 0.82));
    frame = { x: r.x + (r.w - fw) / 2, y: r.y + (r.h - fh) / 2, w: fw, h: fh };
    inner = { x: frame.x + (fw - fit.w) / 2, y: frame.y + (fh - fit.h) / 2, w: fit.w, h: fit.h };
  } else {
    frame = { ...r };
  }
  const radius = Math.min(frame.w, frame.h) * 0.07;

  // glow / shadow under the frame
  if (S.glow) radial(ctx, frame.x + frame.w / 2, frame.y + frame.h / 2, Math.max(frame.w, frame.h) * 0.95, [[0, S.glow], [1, 'rgba(0,0,0,0)']]);
  ctx.save();
  if (S.cardOutline) {
    // Bold style: hard offset shadow, like a sticker
    const off = Math.min(frame.w, frame.h) * 0.035;
    roundRect(ctx, frame.x + off, frame.y + off, frame.w, frame.h, radius);
    ctx.fillStyle = S.cardOutline; ctx.fill();
  } else {
    ctx.shadowColor = S.cardShadow || 'rgba(29,34,48,0.22)';
    ctx.shadowBlur = Math.min(frame.w, frame.h) * 0.16;
    ctx.shadowOffsetY = S.dark ? 0 : frame.h * 0.03;
  }
  roundRect(ctx, frame.x, frame.y, frame.w, frame.h, radius);
  ctx.fillStyle = S.cardFill || '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, frame.x, frame.y, frame.w, frame.h, radius);
  ctx.clip();
  if (pic.cutout) {
    // multiply = the white photo background takes the card's tint, no seams
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(img, box.sx, box.sy, box.sw, box.sh, inner.x, inner.y, inner.w, inner.h);
  } else {
    const c = cover(box, frame.w / frame.h, pic.focus);
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, frame.x, frame.y, frame.w, frame.h);
    // a light inner edge so the photo feels set into the frame
    ctx.strokeStyle = S.dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = Math.max(1, frame.w * 0.004);
    roundRect(ctx, frame.x, frame.y, frame.w, frame.h, radius);
    ctx.stroke();
  }
  ctx.restore();

  if (S.cardOutline) {
    ctx.save();
    ctx.lineWidth = Math.max(3, Math.min(frame.w, frame.h) * 0.012);
    ctx.strokeStyle = S.cardOutline;
    roundRect(ctx, frame.x, frame.y, frame.w, frame.h, radius);
    ctx.stroke();
    ctx.restore();
  }
}

/* ==========================================================================
   Text items. Each returns { h, w, draw(x, y, boxW, align) } for a given
   scale `k` (1 = full size). The stack uses `h` to decide if it fits.
   ========================================================================== */
const ITEMS = {
  deal(ctx, S, d, k, W, max, opt) {
    const deal = d.deal;
    const [fam, wt] = S.dealFont;
    const words = deal.kind === 'word';
    // big part: "1+1", "−25 %" or a word like "Novinka"
    const big = words
      ? fitText(ctx, deal.big, s => `${wt} ${s}px ${fam}`, W, max * k, 18, 2, 0.98)
      : fitRuns(ctx, deal.big, fam, wt, W, max * k, 18);
    // small part (pill): "zadarmo", "zľava"
    let pill = null;
    if (deal.small) {
      const ps = Math.max(12, big.size * (opt.inline ? 0.26 : 0.2));
      pill = pillMeasure(ctx, deal.small.toUpperCase(), `800 ${ps}px ${SANS}`, ps, W, '0.12em');
    }
    const gap = big.size * 0.12;
    const inline = opt.inline && pill && big.width + gap * 2 + pill.w <= W;
    const h = inline ? big.h : big.h + (pill ? gap + pill.h : 0);
    return {
      h, w: inline ? big.width + gap * 2 + pill.w : Math.max(big.width, pill ? pill.w : 0),
      draw(x, y, bw, align) {
        ctx.save();
        ctx.fillStyle = S.dealFill(ctx, y, big.h);
        if (S.dealGlow) { ctx.shadowColor = S.dealGlow; ctx.shadowBlur = big.size * 0.35; }
        if (inline) {
          const total = big.width + gap * 2 + pill.w;
          const sx = alignX(x, bw, total, align);
          drawBig(ctx, big, sx, y, big.width, 'left');
          ctx.restore();
          drawPill(ctx, pill, sx + big.width + gap * 2, y + big.h * 0.56 - pill.h / 2, S.badgeBg, S.badgeInk);
        } else {
          drawBig(ctx, big, x, y, bw, align);
          ctx.restore();
          if (pill) drawPill(ctx, pill, alignX(x, bw, pill.w, align), y + big.h + gap, S.badgeBg, S.badgeInk);
        }
      },
    };
  },

  headline(ctx, S, d, k, W, max, opt) {
    const [fam, wt] = S.headFont;
    const t = fitText(ctx, d.headline, s => `${wt} ${s}px ${fam}`, W, max * k, 12, opt.lines || 2, 1.08);
    return { h: t.h, w: t.width, draw(x, y, bw, align) { ctx.fillStyle = S.ink; drawLines(ctx, t, x, y, bw, align); } };
  },

  name(ctx, S, d, k, W, max, opt) {
    const t = fitText(ctx, d.name, s => `500 ${s}px ${SANS}`, W, max * k, 10, opt.lines || 2, 1.25);
    return { h: t.h, w: t.width, draw(x, y, bw, align) { ctx.fillStyle = S.soft; drawLines(ctx, t, x, y, bw, align); } };
  },

  chips(ctx, S, d, k, W, max) {
    if (!d.chips.length) return { h: 0, w: 0, draw() {} };
    const size = Math.max(10, max * k);
    const gap = size * 0.45;
    const pills = [];
    let used = 0;
    for (const c of d.chips) {
      const p = pillMeasure(ctx, c, `600 ${size}px ${SANS}`, size, W, '0.01em', 0.75, 1.9);
      if (used + p.w > W) break;              // only as many chips as fit on one line
      pills.push(p); used += p.w + gap;
    }
    const total = used - gap;
    return {
      h: pills.length ? pills[0].h : 0, w: total,
      draw(x, y, bw, align) {
        let px = alignX(x, bw, total, align);
        for (const p of pills) { drawPill(ctx, p, px, y, S.chipBg, S.chipInk, S.chipLine); px += p.w + gap; }
      },
    };
  },

  price(ctx, S, d, k, W, max) {
    const pr = d.price;
    const [fam, wt] = S.priceFont;
    const now = fitText(ctx, pr.now, s => `${wt} ${s}px ${fam}`, W, max * k, 14, 1, 1.0);
    // small line above the price: crossed-out old price + pack note
    let small = null;
    const parts = [pr.old, pr.note].filter(Boolean);
    if (parts.length) {
      let fs = Math.max(14, now.size * 0.32);
      ctx.font = `500 ${fs}px ${SANS}`;
      const gap = fs * 0.7;
      const widthAt = () => parts.reduce((a, p) => a + ctx.measureText(p).width, 0) + gap * (parts.length - 1);
      while (widthAt() > W && fs > 9) { fs -= 1; ctx.font = `500 ${fs}px ${SANS}`; }
      small = { fs, gap, w: widthAt() };
    }
    const sh = small ? small.fs * 1.5 : 0;
    return {
      h: sh + now.h, w: Math.max(now.width, small ? small.w : 0),
      draw(x, y, bw, align) {
        if (small) {
          ctx.font = `500 ${small.fs}px ${SANS}`;
          ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          let sx = alignX(x, bw, small.w, align);
          const cy = y + small.fs * 0.6;
          if (pr.old) {
            const ow = ctx.measureText(pr.old).width;
            ctx.fillStyle = S.oldInk; ctx.fillText(pr.old, sx, cy);
            ctx.strokeStyle = S.oldInk; ctx.lineWidth = Math.max(1.5, small.fs * 0.09);
            ctx.beginPath(); ctx.moveTo(sx - 2, cy + small.fs * 0.04); ctx.lineTo(sx + ow + 2, cy + small.fs * 0.04); ctx.stroke();
            sx += ow + small.gap;
          }
          if (pr.note) { ctx.fillStyle = S.soft; ctx.fillText(pr.note, sx, cy); }
        }
        ctx.fillStyle = S.priceInk;
        drawLines(ctx, now, x, y + sh, bw, align);
      },
    };
  },

  cta(ctx, S, d, k, W, max) {
    const size = Math.max(11, max * k);
    const p = pillMeasure(ctx, d.cta + '  →', `700 ${size}px ${SANS}`, size, W, '0.01em', 1.25, 2.6);
    return { h: p.h, w: p.w, draw(x, y, bw, align) { drawPill(ctx, p, alignX(x, bw, p.w, align), y, S.ctaBg, S.ctaInk, null, S.dark ? S.ctaBg : null); } };
  },

  /* price on the left + button on the right, bottoms aligned */
  buy(ctx, S, d, k, W, max, opt) {
    const cta = ITEMS.cta(ctx, S, d, k, W * 0.45, opt.cta);
    const gap = W * 0.04;
    const price = ITEMS.price(ctx, S, d, k, W - cta.w - gap, max);
    return {
      h: Math.max(price.h, cta.h), w: W,
      draw(x, y, bw) {
        const h = Math.max(price.h, cta.h);
        price.draw(x, y + h - price.h, bw - cta.w - gap, 'left');
        // centre the button on the big price figure
        const priceMid = y + h - price.h * 0.42;
        cta.draw(x + bw - cta.w, Math.min(y + h - cta.h, priceMid - cta.h / 2), cta.w, 'left');
      },
    };
  },
};

/** Lay out one column of items; shrink everything until it fits the box. */
function drawStack(ctx, S, d, st) {
  // space after each kind of item, in px at full size (shrinks together with the text)
  const GAP = { deal: 1.15, headline: 0.75, name: 1, chips: 1, price: 0.9, cta: 0, buy: 0 };
  const unit = st.gap || 28;
  let k = 1, built, total;
  for (let tries = 0; tries < 30; tries++) {
    built = st.items
      .map(([key, max, opt]) => Object.assign(ITEMS[key](ctx, S, d, k, st.w, max, opt || {}), { key }))
      .filter(it => it.h > 0);
    total = built.reduce((a, it, i) => a + it.h + (i < built.length - 1 ? GAP[it.key] * unit * k : 0), 0);
    if (total <= st.h) break;
    k *= 0.94;                               // too tall → shrink 6 % and measure again
  }
  let y = st.y;
  if (st.valign === 'center') y = st.y + (st.h - total) / 2;
  if (st.valign === 'bottom') y = st.y + st.h - total;
  built.forEach((it, i) => {
    it.draw(st.x, y, st.w, st.align);
    y += it.h + GAP[it.key] * unit * k;
  });
}

/* ==========================================================================
   The wordmark (drawn as text – not a copy of any real logo file)
   ========================================================================== */
function drawLogo(ctx, S, brand, L) {
  const size = L.size;
  const led = brand.slice(0, 3), rest = brand.slice(3);
  ctx.font = `800 ${size}px ${SANS}`;
  ctx.letterSpacing = '-0.01em';
  const w1 = ctx.measureText(led).width;
  ctx.font = `500 ${size}px ${SANS}`;
  const w2 = ctx.measureText(rest).width;
  const dot = size * 0.2, dotGap = size * 0.34;
  const total = dot * 2 + dotGap + w1 + w2;
  let x = L.align === 'center' ? L.x - total / 2 : L.align === 'right' ? L.x - total : L.x;
  // glowing dot = a tiny light bulb
  ctx.save();
  ctx.shadowColor = S.logoDot; ctx.shadowBlur = S.dark ? size * 0.8 : 0;
  ctx.fillStyle = S.logoDot;
  ctx.beginPath(); ctx.arc(x + dot, L.y, dot, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  x += dot * 2 + dotGap;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = S.logoInk;
  ctx.font = `800 ${size}px ${SANS}`; ctx.fillText(led, x, L.y + size * 0.04);
  ctx.font = `500 ${size}px ${SANS}`; ctx.fillText(rest, x + w1, L.y + size * 0.04);
  ctx.letterSpacing = '0px';
}

function drawDomain(ctx, S, domain, L) {
  ctx.font = `600 ${L.size}px ${SANS}`;
  ctx.letterSpacing = '0.04em';
  ctx.fillStyle = S.muted;
  ctx.textBaseline = 'middle';
  ctx.textAlign = L.align;
  ctx.fillText(domain, L.x, L.y);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
}

/* ==========================================================================
   Public entry point
   ========================================================================== */
/**
 * Draw a banner.
 * @param canvas  target <canvas>
 * @param fmtId   'hero' | 'ig' | 'story' | 'fb'
 * @param styleId 'amber' | 'clean' | 'bold' | 'night'
 * @param data    texts for one market (see buildBannerData in app.js)
 * @param pic     result of prepareImage()
 * @param scale   1 = full size PNG, <1 = small preview
 */
function renderBanner(canvas, fmtId, styleId, data, pic, scale = 1) {
  const F = FORMATS[fmtId], L = LAYOUTS[fmtId], S = STYLES[styleId];
  canvas.width = Math.round(F.w * scale);
  canvas.height = Math.round(F.h * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  const P = L.product;
  S.paint(ctx, F.w, F.h, { x: P.x + P.w / 2, y: P.y + P.h / 2 }, data);
  drawProduct(ctx, S, pic, P);
  drawLogo(ctx, S, data.brand, L.logo);
  drawDomain(ctx, S, data.domain, L.domain);
  for (const st of L.stacks) drawStack(ctx, S, data, st);
  return canvas;
}

/* ==========================================================================
   Small helpers
   ========================================================================== */

/** Find the biggest font size (≤ max) where text fits `maxW` in ≤ maxLines.
    Lines are then balanced so a 2-line headline doesn't end with one word. */
function fitText(ctx, text, font, maxW, max, min, maxLines, lh) {
  // Slovak/Czech/Polish rule: a one-letter word (v, s, z, a, i, w …) must not
  // end a line – glue it to the next word with a non-breaking space.
  text = String(text || '').trim().replace(/(^|\s)(\p{L})\s+/gu, '$1$2\u00a0').replace(/(^|\s)(\p{L})\s+/gu, '$1$2\u00a0');
  let size = Math.floor(max), lines;
  for (; size > min; size = Math.floor(size * 0.96)) {
    ctx.font = font(size);
    lines = wrap(ctx, text, maxW);
    if (lines && lines.length <= maxLines) break;
  }
  ctx.font = font(size);
  lines = wrap(ctx, text, maxW) || [text];
  if (lines.length > maxLines) {                     // last resort: cut with "…"
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trim() + '…';
  } else if (lines.length > 1) {
    // balance: narrow the box while the line count stays the same
    let w = maxW;
    for (let i = 0; i < 20; i++) {
      const t = wrap(ctx, text, w * 0.96);
      if (!t || t.length !== lines.length) break;
      w *= 0.96; lines = t;
    }
  }
  const width = Math.max(...lines.map(l => ctx.measureText(l).width));
  return { lines, size, lh, h: lines.length * size * lh, width, font: font(size) };
}

/** Greedy word wrap. Returns null if a single word is wider than maxW. */
function wrap(ctx, text, maxW) {
  const words = text.split(/ +/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (ctx.measureText(w).width > maxW) return null;
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxW) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Numbers like "1+1" or "−25 %": in a serif font the + and − are hairlines,
    so those two symbols are drawn in the sturdier sans-serif instead. */
function fitRuns(ctx, text, fam, wt, maxW, max, min) {
  const runs = text.split(/([+\u2212])/).filter(Boolean);           // "1", "+", "1"
  const isSym = r => fam === DISPLAY && /^[+\u2212]$/.test(r);
  const fontOf = (r, s) => isSym(r) ? `600 ${s * 0.78}px ${SANS}` : `${wt} ${s}px ${fam}`;
  const widthAt = s => runs.reduce((a, r) => {
    ctx.font = fontOf(r, s);
    return a + ctx.measureText(r).width + (isSym(r) ? s * 0.06 : 0);
  }, 0);
  let size = Math.floor(max);
  while (size > min && widthAt(size) > maxW) size = Math.floor(size * 0.96);
  return { runs, size, lh: 0.98, h: size * 0.98, width: widthAt(size), fontOf, isSym };
}

function drawBig(ctx, t, x, y, w, align) {
  if (!t.runs) return drawLines(ctx, t, x, y, w, align);
  let cx = alignX(x, w, t.width, align);
  const base = y + t.h / 2 + t.size * 0.35;     // centre the capital height in the line
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (const r of t.runs) {
    ctx.font = t.fontOf(r, t.size);
    const pad = t.isSym(r) ? t.size * 0.03 : 0;
    ctx.fillText(r, cx + pad, base);
    cx += ctx.measureText(r).width + pad * 2;
  }
}

function drawLines(ctx, t, x, y, w, align) {
  ctx.font = t.font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  t.lines.forEach((l, i) => ctx.fillText(l, ax, y + (i + 0.5) * t.size * t.lh + t.size * 0.02));
  ctx.textAlign = 'left';
}

function pillMeasure(ctx, text, font, size, maxW, spacing = '0px', padX = 0.8, hMul = 1.9) {
  ctx.font = font; ctx.letterSpacing = spacing;
  let tw = ctx.measureText(text).width;
  ctx.letterSpacing = '0px';
  let s = size;
  while (tw + s * padX * 2 > maxW && s > 9) {          // shrink pill text if needed
    s -= 1; font = font.replace(/\d+(\.\d+)?px/, s + 'px');
    ctx.font = font; ctx.letterSpacing = spacing; tw = ctx.measureText(text).width; ctx.letterSpacing = '0px';
  }
  return { text, font, spacing, tw, w: tw + s * padX * 2, h: s * hMul, size: s };
}

function drawPill(ctx, p, x, y, bg, ink, line, glow) {
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = p.h * 0.6; }
  roundRect(ctx, x, y, p.w, p.h, p.h / 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
  if (line) { ctx.lineWidth = Math.max(1, p.size * 0.07); ctx.strokeStyle = line; roundRect(ctx, x, y, p.w, p.h, p.h / 2); ctx.stroke(); }
  ctx.font = p.font; ctx.letterSpacing = p.spacing;
  ctx.fillStyle = ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(p.text, x + p.w / 2, y + p.h / 2 + p.size * 0.04);
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}

function alignX(x, w, itemW, align) {
  return align === 'center' ? x + (w - itemW) / 2 : align === 'right' ? x + w - itemW : x;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function radial(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function vignette(ctx, W, H, strength) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function vGrad(ctx, y, h, colors) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  return g;
}

/** Fit (w,h) inside (maxW,maxH) keeping proportions. */
function contain(w, h, maxW, maxH) {
  const s = Math.min(maxW / w, maxH / h);
  return { w: w * s, h: h * s };
}

/** Crop a source box to the target aspect ratio, centred on the focus point. */
function cover(box, aspect, focus) {
  let sw = box.sw, sh = box.sh;
  if (sw / sh > aspect) sw = sh * aspect; else sh = sw / aspect;
  const sx = clamp(box.sx + focus.x * box.sw - sw / 2, box.sx, box.sx + box.sw - sw);
  const sy = clamp(box.sy + focus.y * box.sh - sh / 2, box.sy, box.sy + box.sh - sh);
  return { sx, sy, sw, sh };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function seededRandom(seed) {          // tiny "mulberry32" generator
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
