// Triage a "card request" issue: crawl the sources, cross-validate the recurring
// benefits with an LLM (GitHub Models), and edit the catalog so a PR can be opened.
//
// Consumed by .github/workflows/card-request.yml. Node 20+ (global fetch).
//
// Env:
//   GITHUB_TOKEN            token with `models: read` (LLM) — required in CI
//   ISSUE_NUMBER/TITLE/BODY the triggering issue
//   MODEL                   default "openai/gpt-4o"
//   MODELS_ENDPOINT         default GitHub Models inference endpoint
//   GITHUB_OUTPUT           step outputs (set by Actions)
//   MOCK_CARD_JSON          path to a card JSON to use instead of calling the model (tests)
//   DRY_RUN=1               validate + build artifacts but don't write the catalog
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_SRC = path.join(ROOT, 'src', 'data', 'catalog.json');
const CATALOG_PUB = path.join(ROOT, 'public', 'catalog', 'catalog.json');
const WORK = path.join(ROOT, '.card-request');
mkdirSync(WORK, { recursive: true });

const UA =
  'Mozilla/5.0 (compatible; CardsGuruBot/1.0; +https://github.com/QingpingMeng/cardsguru)';
const FREQ = ['monthly', 'quarterly', 'semiannual', 'annual', 'one_time'];
const ANCHOR = ['calendar', 'anniversary'];
const CATS = ['travel', 'hotel', 'airline', 'dining', 'rideshare', 'streaming', 'entertainment', 'shopping', 'grocery', 'wellness', 'rewards', 'other'];
const NETWORKS = ['amex', 'visa', 'mastercard', 'discover'];
const ISSUER_ALIAS = {
  'american express': 'amex', amex: 'amex', chase: 'chase', citi: 'citi', citibank: 'citi',
  'capital one': 'capitalone', capitalone: 'capitalone', 'bank of america': 'boa', boa: 'boa',
  'wells fargo': 'wells', wells: 'wells', 'u.s. bank': 'usbank', 'us bank': 'usbank', usbank: 'usbank',
  barclays: 'barclays',
};

const env = process.env;
const TOKEN = env.GITHUB_TOKEN || env.GH_TOKEN || '';
const MODEL = env.MODEL || 'openai/gpt-4o';
const MODELS_ENDPOINT = env.MODELS_ENDPOINT || 'https://models.github.ai/inference/chat/completions';
const ISSUE_NUMBER = env.ISSUE_NUMBER || '0';
const DRY_RUN = env.DRY_RUN === '1';

function setOutput(key, value) {
  const line = `${key}=${value}`;
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, line + '\n');
  else console.log('[output] ' + line);
}

function finish({ status, draft = false, prTitle = '', comment }) {
  const commentPath = path.join(WORK, 'issue-comment.md');
  writeFileSync(commentPath, comment ?? '', 'utf8');
  setOutput('status', status);
  setOutput('draft', String(draft));
  setOutput('pr_title', prTitle);
  setOutput('pr_branch', `card-request/issue-${ISSUE_NUMBER}`);
  setOutput('pr_body_path', path.relative(ROOT, path.join(WORK, 'pr-body.md')));
  setOutput('comment_path', path.relative(ROOT, commentPath));
  process.exit(0);
}

// ---------------------------------------------------------------- issue form
function parseIssueForm(body) {
  const out = {};
  if (!body) return out;
  const parts = ('\n' + body.replace(/\r/g, '')).split(/\n###\s+/).slice(1);
  for (const seg of parts) {
    const nl = seg.indexOf('\n');
    if (nl === -1) continue;
    const label = seg.slice(0, nl).trim().toLowerCase();
    let value = seg.slice(nl + 1).trim();
    if (/^_no response_$/i.test(value)) value = '';
    out[label] = value;
  }
  return out;
}
const isUrl = (s) => typeof s === 'string' && /^https?:\/\/\S+$/i.test(s.trim());

// ------------------------------------------------------------------- crawling
function stripHtml(html) {
  let h = html;
  const m = h.match(/<div[^>]*class="[^"]*post-entry[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/article>/i);
  if (m) h = m[1];
  return h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&#038;|&amp;/g, '&')
    .replace(/&#8217;|&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en,zh-CN;q=0.8,zh;q=0.6' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// Keep the densest benefit-relevant window to fit the model budget.
function relevantSlice(text, max = 5000) {
  if (text.length <= max) return text;
  const kw = /(报销|抵扣|每月|每季度|每半年|每年|credit|statement credit|annual fee|年费|会员|enroll|\$\d)/gi;
  let best = 0, bestScore = -1;
  for (let i = 0; i < text.length; i += 500) {
    const win = text.slice(i, i + max);
    const score = (win.match(kw) || []).length;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return text.slice(best, best + max);
}

async function findUsccgUrl(cardName) {
  try {
    const html = await fetchText('https://www.uscreditcardguide.com/credit-cards/');
    const links = [...html.matchAll(/href="(https:\/\/www\.uscreditcardguide\.com\/[^"?/]+\/)"/g)]
      .map((m) => m[1]);
    const tokens = cardName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
    let best = null, bestScore = 0;
    for (const url of new Set(links)) {
      const slug = url.replace(/\/$/, '').split('/').pop().toLowerCase();
      const score = tokens.reduce((s, t) => s + (slug.includes(t) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = url; }
    }
    return bestScore >= 2 ? best : null;
  } catch {
    return null;
  }
}

async function gatherSources(fields, cardName) {
  const urls = [];
  const push = (u, label) => { if (isUrl(u)) urls.push({ url: u.trim(), label }); };
  push(fields['uscreditcardguide.com url'], 'uscreditcardguide.com');
  if (!urls.some((u) => /uscreditcardguide\.com/.test(u.url))) {
    const found = await findUsccgUrl(cardName);
    if (found) urls.push({ url: found, label: 'uscreditcardguide.com (auto-matched)' });
  }
  push(fields['issuer benefits url'], 'issuer page');
  push(fields['additional source url'], 'additional source');

  const sources = [];
  for (const { url, label } of urls) {
    try {
      const text = relevantSlice(stripHtml(await fetchText(url)));
      if (text.trim().length > 120) sources.push({ url, label, text });
    } catch (err) {
      console.warn(`crawl failed for ${url}: ${err.message}`);
    }
  }
  return sources;
}

// -------------------------------------------------------------------- the LLM
function buildPrompt(cardName, fields, sources, catalog) {
  const issuers = catalog.issuers.map((i) => `${i.id} (${i.name})`).join(', ');
  const example = JSON.stringify(catalog.cards.find((c) => c.id === 'amex-green') ?? catalog.cards[0], null, 2);
  const sourceBlock = sources.map((s, i) => `--- SOURCE ${i + 1} (${s.label}): ${s.url} ---\n${s.text}`).join('\n\n');
  const system =
    'You are a meticulous credit-card benefits analyst for the CardsGuru catalog. ' +
    'You read English and Chinese sources. You output STRICT JSON only, no prose, no code fences.';
  const user = `Build a catalog entry for the credit card: "${cardName}".

Return a JSON object of this exact shape:
{
  "card": {
    "id": "<kebab-case, e.g. usbank-altitude-reserve>",
    "issuerId": "<one of the known issuer ids, or a new kebab id>",
    "name": "<official product name>",
    "network": <one of ${JSON.stringify(NETWORKS)} or omit>,
    "annualFee": <number or omit>,
    "productUrl": "<official issuer URL or omit>",
    "artRef": "<same as id>",
    "benefits": [
      {
        "id": "<cardId>:<benefit-slug>",
        "title": "...",
        "description": "...",
        "category": <one of ${JSON.stringify(CATS)}>,
        "value": { "amount": <number> },   // omit for non-monetary perks (e.g. free night)
        "cap": "<optional human note>",
        "frequency": <one of ${JSON.stringify(FREQ.filter((f) => f !== 'one_time'))}>,
        "resetAnchor": <one of ${JSON.stringify(ANCHOR)}>,   // "anniversary" = membership year
        "enrollmentRequired": <true|false>,
        "sourceUrl": "<url>",
        "validFrom": "YYYY-MM-DD"
      }
    ]
  },
  "newIssuer": { "id": "...", "name": "..." },   // ONLY if issuerId is not in the known list
  "confidence": <0..1>,
  "crossValidation": "<2-4 sentences: which sources agreed/disagreed on amounts & cadence>"
}

Hard rules:
- ONLY include RECURRING benefits that reset on a schedule (monthly / quarterly / semiannual / annual, calendar or membership-year). 
- EXCLUDE one-time sign-up bonuses, welcome offers, elite status, lounge access without a credit value, and every-4-year Global Entry/TSA credits.
- Prefer figures confirmed by MULTIPLE sources; if sources disagree, use the most recent and note it in crossValidation.
- Known issuer ids: ${issuers}. Reuse one if it matches; otherwise provide "newIssuer".
- If you cannot find any recurring benefit, return {"card": null, "confidence": 0, "crossValidation": "reason"}.

Reference example of a valid card object:
${example}

User-provided known benefits (may be empty):
${fields['known recurring benefits'] || '(none)'}

Sources:
${sourceBlock || '(no sources could be fetched)'}`;
  return { system, user };
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in model output');
  return JSON.parse(raw.slice(start, end + 1));
}

async function callModel(prompt) {
  const res = await fetch(MODELS_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Models API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content ?? '';
  return extractJson(content);
}

// ---------------------------------------------------------------- validation
function normalizeCard(raw, catalog) {
  const errors = [];
  const card = raw?.card;
  if (!card || typeof card !== 'object') return { errors: ['model returned no card'] };

  const id = String(card.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  if (!id) errors.push('card.id missing');
  if (catalog.cards.some((c) => c.id === id)) errors.push(`card id "${id}" already exists in the catalog`);

  let issuerId = String(card.issuerId || '').trim().toLowerCase();
  const known = new Set(catalog.issuers.map((i) => i.id));
  let newIssuer = null;
  if (!known.has(issuerId)) {
    if (raw.newIssuer?.id && raw.newIssuer?.name) {
      newIssuer = { id: String(raw.newIssuer.id).toLowerCase().replace(/[^a-z0-9-]/g, ''), name: String(raw.newIssuer.name) };
      issuerId = newIssuer.id;
    } else {
      errors.push(`unknown issuerId "${issuerId}" and no newIssuer provided`);
    }
  }

  const out = { id, issuerId, name: String(card.name || '').trim() };
  if (!out.name) errors.push('card.name missing');
  if (card.network && NETWORKS.includes(card.network)) out.network = card.network;
  if (Number.isFinite(card.annualFee)) out.annualFee = card.annualFee;
  if (isUrl(card.productUrl)) out.productUrl = card.productUrl.trim();
  out.artRef = String(card.artRef || id);
  if (isUrl(card.imageUrl)) out.imageUrl = card.imageUrl.trim();

  const benefits = Array.isArray(card.benefits) ? card.benefits : [];
  out.benefits = [];
  for (const b of benefits) {
    const bslug = String(b.id || '').includes(':') ? String(b.id).split(':').pop() : String(b.id || b.title || '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const bid = `${id}:${bslug}`;
    const freq = FREQ.includes(b.frequency) ? b.frequency : null;
    if (!freq || freq === 'one_time') continue; // recurring only
    const nb = {
      id: bid,
      title: String(b.title || '').trim() || bslug,
      description: String(b.description || '').trim(),
      category: CATS.includes(b.category) ? b.category : 'other',
      frequency: freq,
      resetAnchor: ANCHOR.includes(b.resetAnchor) ? b.resetAnchor : 'calendar',
    };
    if (b.value && Number.isFinite(b.value.amount)) nb.value = { amount: b.value.amount };
    if (b.cap) nb.cap = String(b.cap);
    if (b.enrollmentRequired === true) nb.enrollmentRequired = true;
    if (isUrl(b.sourceUrl)) nb.sourceUrl = b.sourceUrl.trim();
    if (b.terms) nb.terms = String(b.terms);
    if (/^\d{4}-\d{2}-\d{2}$/.test(b.validFrom || '')) nb.validFrom = b.validFrom;
    out.benefits.push(nb);
  }
  if (out.benefits.length === 0) errors.push('no recurring benefits found');
  // ensure unique benefit ids
  const seen = new Set();
  out.benefits = out.benefits.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));

  return { card: out, newIssuer, errors };
}

// ------------------------------------------------------------- catalog insert
function insertIntoCatalog(card, newIssuer) {
  let text = readFileSync(CATALOG_SRC, 'utf8');
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  text = text.replace(/("catalogVersion":\s*)(\d+)/, (_m, p, n) => p + (Number(n) + 1));
  text = text.replace(/("updatedAt":\s*)"[^"]*"/, `$1"${new Date().toISOString()}"`);
  if (newIssuer) {
    const before = text;
    text = text.replace(
      /(\r?\n {2}\],\r?\n {2}"cards")/,
      (m) => `,${eol}    { "id": "${newIssuer.id}", "name": "${newIssuer.name}" }${m}`,
    );
    if (text === before) throw new Error('could not locate the issuers array to add a new issuer');
  }
  const cardText = JSON.stringify(card, null, 2).split('\n').map((l) => '    ' + l).join(eol);
  const before = text;
  text = text.replace(/(\r?\n {2}\]\r?\n\}\r?\n?)$/, (m) => `,${eol}${cardText}${m}`);
  if (text === before) throw new Error('could not locate the end of the cards array to append the new card');
  JSON.parse(text); // sanity: still valid JSON
  const target = DRY_RUN ? path.join(WORK, 'catalog.preview.json') : CATALOG_SRC;
  writeFileSync(target, text, 'utf8');
  if (!DRY_RUN) writeFileSync(CATALOG_PUB, text, 'utf8');
}

// --------------------------------------------------------------- PR artifacts
function benefitsTable(card) {
  const rows = card.benefits.map((b) => {
    const val = b.value ? `$${b.value.amount}` : '—';
    const anchor = b.resetAnchor === 'anniversary' ? 'membership yr' : 'calendar';
    return `| ${b.title} | ${b.frequency} (${anchor}) | ${val} | ${b.enrollmentRequired ? 'yes' : 'no'} |`;
  });
  return ['| Benefit | Resets | Value | Enroll |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

function writePrArtifacts(card, newIssuer, meta, sources) {
  const draft = meta.confidence < 0.6;
  const title = `Add ${card.name} to the catalog (closes #${ISSUE_NUMBER})`;
  const srcList = sources.map((s) => `- ${s.label}: ${s.url}`).join('\n') || '- (no sources fetched — verify manually)';
  const body = `## 🤖 Automated card request

Closes #${ISSUE_NUMBER}.

Adds **${card.name}** \`${card.id}\`${newIssuer ? ` and a new issuer \`${newIssuer.id}\` (${newIssuer.name})` : ''}.

- **Issuer:** \`${card.issuerId}\`${card.network ? ` · **Network:** ${card.network}` : ''}${card.annualFee != null ? ` · **Annual fee:** $${card.annualFee}` : ''}
- **Model confidence:** ${(meta.confidence * 100).toFixed(0)}%${draft ? ' → opened as **draft** for closer review' : ''}

### Recurring benefits
${benefitsTable(card)}

### Cross-validation
${meta.crossValidation || '_n/a_'}

### Sources crawled
${srcList}

### Maintainer checklist
- [ ] Amounts, reset cadence, and \`enrollmentRequired\` match the issuer's current terms
- [ ] Only genuinely **recurring** credits are included (no sign-up bonuses / status)
- [ ] Add a real \`imageUrl\` (issuer CDN) and/or an \`artRef\` gradient
- [ ] \`npm run typecheck && npm run lint && npm run test && npm run build\`

> Generated by \`scripts/ingest-card-request.mjs\` via GitHub Models (${MODEL}). Data may be imperfect — please verify before merging.
`;
  writeFileSync(path.join(WORK, 'pr-body.md'), body, 'utf8');
  return { draft, title };
}

// --------------------------------------------------------------------- driver
async function main() {
  const cardName = (parseIssueForm(env.ISSUE_BODY)['card name'] || '').trim() ||
    (env.ISSUE_TITLE || '').replace(/^\[card request\]:?\s*/i, '').trim();
  const fields = parseIssueForm(env.ISSUE_BODY);
  if (!cardName) {
    return finish({ status: 'failed', comment: '⚠️ I could not read a **card name** from this issue. Please use the "Card request" template.' });
  }
  console.log(`Triaging card request: "${cardName}"`);

  const sources = await gatherSources(fields, cardName);
  console.log(`Gathered ${sources.length} source(s).`);

  const catalog = JSON.parse(readFileSync(CATALOG_SRC, 'utf8'));

  let raw;
  try {
    if (env.MOCK_CARD_JSON) {
      raw = JSON.parse(readFileSync(env.MOCK_CARD_JSON, 'utf8'));
    } else {
      if (!TOKEN) throw new Error('no GITHUB_TOKEN for the Models API');
      raw = await callModel(buildPrompt(cardName, fields, sources, catalog));
    }
  } catch (err) {
    const excerpt = sources.map((s) => `<details><summary>${s.label}: ${s.url}</summary>\n\n\`\`\`\n${s.text.slice(0, 1500)}\n\`\`\`\n</details>`).join('\n');
    return finish({
      status: 'failed',
      comment: `⚠️ Automated extraction failed: \`${err.message}\`.\n\nHere's what I crawled so a maintainer can add **${cardName}** manually:\n\n${excerpt || '_no sources fetched — please add a source URL to the issue._'}`,
    });
  }

  const { card, newIssuer, errors } = normalizeCard(raw, catalog);
  if (errors.length) {
    return finish({
      status: 'failed',
      comment: `⚠️ I crawled and analyzed **${cardName}** but couldn't produce a valid catalog entry:\n${errors.map((e) => `- ${e}`).join('\n')}\n\nA maintainer can take it from here.`,
    });
  }

  const meta = { confidence: Number(raw.confidence) || 0.5, crossValidation: raw.crossValidation || '' };
  insertIntoCatalog(card, newIssuer);
  const { draft, title } = writePrArtifacts(card, newIssuer, meta, sources);

  return finish({
    status: 'success',
    draft,
    prTitle: title,
    comment: `✅ Crawled and cross-validated **${card.name}** and opened a pull request with ${card.benefits.length} recurring benefit(s)${draft ? ' (as a draft — confidence was moderate)' : ''}. Thanks for the request!`,
  });
}

main().catch((err) => {
  console.error(err);
  finish({ status: 'failed', comment: `⚠️ The card-request bot hit an unexpected error: \`${err.message}\`.` });
});
