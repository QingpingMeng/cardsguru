# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. Read this first.

## What CardsGuru is

A **local-first PWA** that tracks the **recurring benefits** of credit cards (monthly / quarterly /
semiannual / annual / membership-year credits): mark them used each period, and get warned before
unused credits expire. There is **no backend** — the app runs entirely in the browser, and a user's
data optionally syncs through **a private GitHub repository they own**.

- **Stack:** React 18 · TypeScript · Vite · Zustand · IndexedDB (`idb`) · date-fns · Zod ·
  framer-motion · vite-plugin-pwa · Vitest. Node 20.
- **Path alias:** `@` → `src` (see `vite.config.ts` + `tsconfig`).

## Commands

```bash
npm install          # or npm ci
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # tsc -b (typecheck) + vite build
npm run preview      # preview the production build
npm run test         # Vitest (jsdom + fake-indexeddb)
npm run lint         # ESLint (ts,tsx; --max-warnings 0)
npm run typecheck    # tsc -b --noEmit
npm run format       # prettier
npm run sync:catalog # mirror src/data/catalog.json -> public/catalog/catalog.json
npm run gen:icons    # regenerate PWA PNG icons from the brand mark
```

`predev` and `prebuild` automatically run `sync:catalog` + `gen:icons`.

### Validation gate (run before committing or opening a PR)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

There are ~61 tests, including a **catalog integrity test** (`src/lib/catalog/catalog.test.ts`) that
enforces unique card ids, benefit ids prefixed by their card id, ≥1 benefit per card, and valid
issuer references. Keep it green.

## Architecture

```
src/
  components/   Reusable UI. glass/ holds the Liquid Glass primitives (GlassPanel, GlassButton,
                Badge, SegmentedControl, Switch). CardArt.tsx renders card gradients/images.
                BrandMark.tsx is the app logo (keep in sync with public/favicon.svg).
  features/     One folder per screen: dashboard, expiring, cards, history, updates, settings,
                onboarding. Screens compose lib + store + components.
  hooks/        useBenefits() — the memoized derived-benefits view used across screens.
  lib/
    catalog/    Catalog schema (Zod), loader, helpers (isBenefitActive, indexCatalog, ...).
    data/       User-data schema (OwnedCard, Completion, Profile) + IndexedDB store (db.ts).
    period/     Period engine: calendar vs anniversary reset cycles, "expiring soon" logic.
    benefits/   deriveBenefits() — joins catalog + owned cards + completions into what the UI shows.
    sync/       GitHub sync provider + last-write-wins merge engine.
    storage/, notifications/, format.ts, cn.ts, motion.ts
  store/        appStore.ts (Zustand, the main app state) + preferences.ts (theme/transparency).
  data/         catalog.json — the bundled catalog snapshot (canonical source of card data).
  routes/       AppRouter (HashRouter).
  styles/       tokens.css, base.css, glass.css, components.css, layout.css.
public/         catalog/catalog.json (served at runtime) + generated icons + favicon.svg.
scripts/        sync-catalog.mjs, generate-icons.mjs, screenshots.mjs, ingest-card-request.mjs.
```

## Data model & sync (important)

- **User data** lives in IndexedDB (`src/lib/data/db.ts`) and, if connected, syncs to three JSON
  files in the user's private repo: `profile.json`, `cards.json`, `completions.json`.
- **Merge is last-write-wins per record** by each record's ISO `updatedAt`; deletes propagate via a
  `deleted` tombstone (`src/lib/sync/merge.ts`). Reads strip tombstones with `withoutDeleted`.
- A completion is keyed by **`completionId = ${userCardId}:${benefitId}:${periodKey}`**.
- **"Set & forget"** (auto-used every period) is stored as a sentinel completion with
  `periodKey === AUTO_PERIOD_KEY` (`'auto'`, see `src/lib/data/schema.ts`). It rides the normal
  sync/merge machinery and is filtered out of the History screen. `deriveBenefits` folds it into
  `used`/`auto`.
- The user's GitHub token is stored **only** in the browser's IndexedDB and is sent only to
  `api.github.com`. **Never** log, commit, or transmit it elsewhere.

## The catalog — rules for editing card data

`src/data/catalog.json` is the source of truth (schema in `src/lib/catalog/schema.ts`).

- **`frequency`** ∈ `monthly | quarterly | semiannual | annual | one_time`.
- **`resetAnchor`** ∈ `calendar | anniversary` (`anniversary` = cardmember/membership year).
- **`category`** ∈ travel, hotel, airline, dining, rideshare, streaming, entertainment, shopping,
  grocery, wellness, rewards, other.
- **`network`** ∈ amex, visa, mastercard, discover.
- Benefit id convention: **`${cardId}:${slug}`**. Cards reference an existing issuer in `issuers`.

**Critical conventions:**

1. **Preserve benefit `id`s** when a benefit persists — completions are keyed by benefit id, so
   changing an id silently orphans users' history. Only update its fields.
2. **Retire a benefit with `validTo`** (an ISO date), never by deleting it. `isBenefitActive()`
   filters expired benefits, and this protects historical completions.
3. On **any** catalog data change, bump `catalogVersion` and update `updatedAt`, then run
   `npm run sync:catalog` (prebuild does this too). The update module uses `catalogVersion` to
   detect newer data.
4. `catalog.json` uses **CRLF line endings** — any *programmatic* edit must be EOL-aware and
   EOL-preserving (see `scripts/ingest-card-request.mjs` for the pattern). Hand edits via the normal
   editor are fine.
5. Amex cards use a **5-digit** identifier (the `last4` field accepts `/^\d{4,5}$/`); the add-card
   form is issuer-aware.

## UI / Liquid Glass conventions

- All visual styling is driven by **CSS custom properties** in `src/styles/tokens.css`. Prefer
  tokens over hard-coded values.
- The macOS-style glass material lives in `src/styles/glass.css`: it layers a `#lg-refraction` SVG
  filter (defined in `index.html`) via `backdrop-filter`, gated behind `--glass-backdrop*` vars so
  reduced-transparency users get a flat fallback. Respect the light/dark and
  reduced-transparency/motion fallbacks.
- Form fields use `.field` / `.input` (fixed 40px height) and the responsive two-column `.field-grid`
  for paired inputs. Reuse these instead of new layouts so forms stay consistent.

## Generated assets

- **Icons:** the brand mark exists in three places that must stay consistent —
  `src/components/BrandMark.tsx` (in-app SVG), `public/favicon.svg`, and `scripts/generate-icons.mjs`
  (procedural, dependency-free PNGs regenerated on predev/prebuild). If you change the logo, update
  all three.
- **Screenshots** in `docs/screenshots/` (used by the README) are produced by
  `scripts/screenshots.mjs` against the running dev server. It needs Playwright, installed
  transiently: `npm i --no-save playwright && npx playwright install chromium`, then
  `node scripts/screenshots.mjs`.

## Automation: the card-request bot

- Issue template `.github/ISSUE_TEMPLATE/card-request.yml` lets users request a missing card.
- `.github/workflows/card-request.yml` fires on such issues and runs
  `scripts/ingest-card-request.mjs`, which: parses the form, crawls uscreditcardguide.com + the
  issuer page, cross-validates the **recurring** benefits with **GitHub Models** (`models: read`),
  edits the catalog with a minimal diff, and opens a PR (draft when confidence is low). It filters
  out one-time bonuses/status perks and never self-merges.
- The script is testable locally without CI: set `DRY_RUN=1` and `MOCK_CARD_JSON=<path>` to skip the
  model call and write a preview instead of the real catalog.

## Deployment

- Push to `main` → `.github/workflows/deploy.yml` type-checks, lints, tests, builds, and publishes to
  **GitHub Pages**. Pages **Source must be "GitHub Actions"** (not a branch).
- The site is served from the custom domain **`cc.qingping.me`** (declared via `public/CNAME`), so it
  loads from the domain root — no `CARDSGURU_BASE` override is needed. Routing uses `HashRouter` so
  deep links work. DNS: a `CNAME` record maps `cc.qingping.me` → `qingpingmeng.github.io`.

## Do / Don't

- **Do** keep changes surgical, run the validation gate, and preserve existing formatting.
- **Do** add or update tests when changing `lib/` logic or the catalog schema.
- **Don't** commit `dist/`, `*.tsbuildinfo`, `.env*` (except `.env.example`), `node_modules/`, or the
  bot's `.card-request/` scratch dir — all are gitignored.
- **Don't** introduce a backend or a server dependency; this app is intentionally client-only.
