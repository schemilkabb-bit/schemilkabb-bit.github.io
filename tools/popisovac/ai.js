// ─────────────────────────────────────────────────────────────
//  Popisovač – the AI part
//  1) SYSTEM_PROMPT – the "job description" for Claude
//  2) SCHEMA        – the exact JSON shape Claude must answer in
//  3) generateDescriptions() – sends one request and returns clean data
//  4) explainError()        – turns technical errors into friendly messages
// ─────────────────────────────────────────────────────────────

import { MARKETS } from "./texts.js";

// The official Anthropic TypeScript SDK, loaded straight from a CDN as an
// ES module (no build step). If the first CDN fails, we try the second one.
const SDK_URLS = [
  "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm",
  "https://esm.sh/@anthropic-ai/sdk@1.3.0",
];

const MODEL = "claude-opus-5-5";

// We load the SDK only when the visitor actually generates something,
// so demo mode works even if the CDN is blocked.
let sdkModule = null;
async function loadSdk() {
  if (sdkModule) return sdkModule;
  for (const url of SDK_URLS) {
    try {
      sdkModule = await import(url);
      return sdkModule;
    } catch (err) {
      console.warn("SDK could not be loaded from", url, err);
    }
  }
  throw Object.assign(new Error("SDK load failed"), { kind: "sdk" });
}

// ── 1) System prompt ─────────────────────────────────────────
// Written in English (Claude follows it best), but it tells Claude to write
// the actual copy in each market's own language.
export const SYSTEM_PROMPT = `You are a senior e-commerce copywriter and SEO specialist for LEDAKCIA, a Central European network of 8 Shoptet e-shops selling LED lighting and smart-home products (run by LEDart s.r.o., with a physical store in Bratislava).

Your job: turn raw product data into product-page copy that is accurate, easy to understand for ordinary customers, and ready to paste into Shoptet.

MARKETS AND LANGUAGES
Write each market in its own native language, as a local copywriter would – never a word-for-word translation of Slovak:
- sk → Slovak (LEDakcia.sk)
- cz → Czech (LEDakce.cz)
- pl → Polish (LEDakcja.pl)
- at → German as used in Austria (LEDaktion.co.at), e.g. "Glühbirne" is fine
- hr → Croatian (LEDakcija.hr)
- si → Slovenian (LEDakcija.si)
- hu → Hungarian (LEDjoaron.hu)
- ro → Romanian with correct diacritics ș ț ă â î (LEDpromotia.ro)
Use the correct local terms for lighting (e.g. bulb, socket/thread E27, floodlight, pendant light, colour temperature, luminous flux, IP rating). Use local number formatting (e.g. 3,2 V in most of these languages) and keep units as symbols (W, lm, K, mAh, mm, V).

ACCURACY – THE MOST IMPORTANT RULE
- Use only facts present in the product data. Never invent specifications, dimensions, lifetimes, certificates, colour temperatures, materials, package contents or comparisons.
- If a value is null or missing, do not mention it and do not guess it.
- The "watts" field was extracted automatically from the product name. It can mean the LED power, the solar panel power, or the maximum bulb wattage of a fixture. Read the text to decide, and say exactly what it is.
- Manufacturer claims (energy savings, lifetime) should be attributed to the manufacturer.
- If the source data is ambiguous, contradictory or missing something customers usually ask about, keep it out of the copy and mention it in review_notes instead.

EXPLAIN THE NUMBERS FOR NORMAL PEOPLE
Customers are not lighting engineers. When the data contains them, explain briefly in plain words:
- lumens (lm) = how much light; compare to a classic bulb only if the data gives that equivalent;
- Kelvin (K) = light colour: around 2700 K warm and cosy, around 4000 K neutral, 6000 K+ cool daylight;
- IP rating = protection against dust and water (e.g. IP44 splashes, IP65 dust-tight and water jets).

TONE
- friendly: warm, conversational, addresses the customer directly, light and positive, no hype or exclamation spam;
- professional: confident, clear, polished, neutral voice, benefits first;
- technical: precise and structured, specs first, short sentences, no fluff.

OUTPUT FIELDS (for each requested market)
- product_name: the localized product name for the H1 (natural, includes key parameters).
- seo_title: at most 60 characters including spaces. Main keyword first. Do not add the shop name.
- meta_description: at most 155 characters including spaces. One or two sentences with the main benefit and a key parameter; ends naturally.
- short_description: exactly 2 sentences for the top of the product page.
- description_html: clean HTML for Shoptet using only <h2>, <h3>, <p>, <ul>, <li>, <strong>. No inline styles, classes, ids, links, images, tables, emoji or markdown. Start with an <h2>. Structure: a benefit-led intro, the key parameters explained in plain words, usage, and important notes (e.g. bulb not included).
- benefits: 3 to 5 short benefit bullets (plain text, no HTML), each under 70 characters.
- keywords: 5 to 8 lowercase search phrases that real customers in that country actually type into Google for this kind of product, in that language (include generic category terms, not only the exact model).

review_notes: 0 to 4 short notes for the copywriter (Emília) about anything to verify before publishing. Write them in the language requested in the user message.

Return only the JSON that matches the schema.`;

// ── 2) JSON schema ───────────────────────────────────────────
// Structured outputs guarantee Claude answers in exactly this shape.
// Every object needs `additionalProperties: false` and a `required` list.
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["review_notes", "results"],
  properties: {
    review_notes: { type: "array", items: { type: "string" } },
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "market", "product_name", "seo_title", "meta_description",
          "short_description", "description_html", "benefits", "keywords",
        ],
        properties: {
          market: { type: "string", enum: MARKETS.map((m) => m.id) },
          product_name: { type: "string" },
          seo_title: { type: "string" },
          meta_description: { type: "string" },
          short_description: { type: "string" },
          description_html: { type: "string" },
          benefits: { type: "array", items: { type: "string" } },
          keywords: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

// Plain-language length targets for the long description.
const LENGTH_GUIDE = {
  short: "short: about 80–130 words in description_html",
  medium: "medium: about 150–250 words in description_html",
  long: "long: about 300–450 words in description_html",
};

// Builds the user message: the product facts + the chosen options.
function buildUserMessage({ product, rawText, rawName, tone, length, marketIds, uiLang }) {
  let facts;
  if (product) {
    // Only the fields that matter for copywriting (no price – it differs per market).
    facts = {
      name: product.name,
      brand: product.brand,
      category: product.category,
      current_shop_text: product.short || null,
      supplier_specs: product.specs || null,
      watts: product.watts,
      lumens: product.lumens,
      kelvin: product.kelvin,
      ip: product.ip,
    };
  } else {
    facts = { name: rawName || null, raw_supplier_text: rawText };
  }

  const markets = MARKETS.filter((m) => marketIds.includes(m.id))
    .map((m) => `${m.id} (${m.language}, ${m.shop})`)
    .join(", ");

  return [
    "PRODUCT DATA (the only source of truth):",
    JSON.stringify(facts, null, 2),
    "",
    `Tone: ${tone}`,
    `Length: ${LENGTH_GUIDE[length]}`,
    `Markets to write, in this order: ${markets}`,
    `Write review_notes in ${uiLang === "en" ? "English" : "Slovak"}.`,
  ].join("\n");
}

// ── 3) The actual call ───────────────────────────────────────
// onProgress(step, info) lets the UI show what is happening:
//   "connect" → "thinking" → "writing" (info.done = finished languages) → "check"
export async function generateDescriptions(opts) {
  const { apiKey, marketIds, onProgress = () => {}, signal } = opts;

  const sdk = await loadSdk();
  const Anthropic = sdk.default;
  onProgress("connect");

  // dangerouslyAllowBrowser: the visitor uses their OWN key in their OWN
  // browser, so this is fine here (never do this with a company key).
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    // Server-side fallback: if the request is declined by a safety
    // classifier, the API automatically retries on a suitable model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(opts) }],
  });

  // "Cancel" button → stop the stream.
  if (signal) signal.addEventListener("abort", () => stream.abort(), { once: true });

  // Progress: a new content block tells us whether Claude thinks or writes.
  stream.on("streamEvent", (event) => {
    if (event.type === "content_block_start") {
      if (event.content_block.type === "thinking") onProgress("thinking");
      if (event.content_block.type === "text") onProgress("writing", { done: 0 });
    }
  });
  // While writing, count how many languages are already finished
  // ("keywords" is the last field of each language in the schema).
  stream.on("text", (_delta, snapshot) => {
    const done = (snapshot.match(/"keywords"\s*:/g) || []).length;
    onProgress("writing", { done: Math.min(done, marketIds.length) });
  });

  const message = await stream.finalMessage();
  onProgress("check");

  // Always check WHY the model stopped before reading the answer.
  if (message.stop_reason === "refusal") throw Object.assign(new Error("refusal"), { kind: "refusal" });
  if (message.stop_reason === "max_tokens") throw Object.assign(new Error("max_tokens"), { kind: "maxTokens" });

  const textBlock = message.content.find((block) => block.type === "text");
  let data;
  try {
    data = JSON.parse(textBlock ? textBlock.text : "");
  } catch {
    throw Object.assign(new Error("parse"), { kind: "parse" });
  }
  if (!data || !Array.isArray(data.results)) {
    throw Object.assign(new Error("parse"), { kind: "parse" });
  }

  // Keep only requested markets, in the shop's usual order.
  data.results = MARKETS.map((m) => data.results.find((r) => r.market === m.id))
    .filter((r) => r && marketIds.includes(r.market));
  return data;
}

// ── 4) Friendly errors ───────────────────────────────────────
// Returns { key, msg } – `key` is a UI dictionary key (errAuth, errRate…).
export function explainError(err) {
  if (err && err.kind) return { key: "err" + err.kind[0].toUpperCase() + err.kind.slice(1) };
  const sdk = sdkModule || {};
  const is = (name) => sdk[name] && err instanceof sdk[name];

  if (is("APIUserAbortError")) return { key: "errAborted" };
  if (is("AuthenticationError")) return { key: "errAuth" };
  if (is("PermissionDeniedError")) return { key: "errPermission" };
  if (is("RateLimitError")) return { key: "errRate" };
  if (is("APIConnectionError")) return { key: "errNetwork" };
  if (is("BadRequestError")) return { key: "errBadRequest", msg: shortMessage(err) };
  if (is("APIError") && (err.status === 529 || err.status >= 500)) return { key: "errOverloaded" };
  if (err && err.name === "AbortError") return { key: "errAborted" };
  if (err instanceof TypeError) return { key: "errNetwork" };
  return { key: "errUnknown", msg: shortMessage(err) };
}

// The API puts the human-readable reason inside err.error.error.message.
function shortMessage(err) {
  const msg = err?.error?.error?.message || err?.message || String(err);
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}
