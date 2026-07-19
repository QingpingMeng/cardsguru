# Copilot instructions for CardsGuru

CardsGuru is a **local-first PWA** (React 18 + TypeScript + Vite + Zustand + IndexedDB) that tracks
the **recurring benefits** of credit cards. There is **no backend**; a user's data optionally syncs
to **a private GitHub repo they own**. See [`AGENTS.md`](../AGENTS.md) for the full guide.

## Commands

- Dev: `npm run dev` · Build: `npm run build` · Preview: `npm run preview`
- Test: `npm run test` (Vitest + jsdom) · Lint: `npm run lint` · Types: `npm run typecheck`
- Catalog sync: `npm run sync:catalog` · Icons: `npm run gen:icons`
- **Before committing / opening a PR:** `npm run typecheck && npm run lint && npm run test && npm run build`

## Conventions & gotchas (read before editing)

- **Path alias:** `@` → `src`.
- **Catalog** (`src/data/catalog.json`, schema in `src/lib/catalog/schema.ts`):
  - Enums — `frequency`: monthly|quarterly|semiannual|annual|one_time; `resetAnchor`:
    calendar|anniversary; plus fixed `category` and `network` enums. Benefit id = `${cardId}:${slug}`.
  - **Preserve benefit `id`s** when a benefit persists (completions are keyed by benefit id).
  - **Retire benefits with `validTo`, never by deleting** (protects user history).
  - On any data change, bump `catalogVersion` + `updatedAt` and run `npm run sync:catalog`.
  - The file uses **CRLF**; programmatic edits must be EOL-preserving.
- **User data / sync:** completion key is `${userCardId}:${benefitId}:${periodKey}`. Merge is
  last-write-wins by `updatedAt` with `deleted` tombstones. "Set & forget" is a sentinel completion
  with `periodKey === AUTO_PERIOD_KEY`.
- **Secrets:** the user's GitHub token lives only in browser IndexedDB and goes only to
  `api.github.com`. Never log, commit, or send it elsewhere.
- **Styling:** use the CSS custom properties in `src/styles/tokens.css` and the Liquid Glass classes
  in `src/styles/glass.css`; respect light/dark and reduced-transparency/motion fallbacks. Reuse
  `.field` / `.field-grid` for forms.
- **Brand mark** is mirrored in `src/components/BrandMark.tsx`, `public/favicon.svg`, and
  `scripts/generate-icons.mjs` — update all three together.
- Add/update tests when changing `src/lib/` logic or the catalog schema; keep the catalog integrity
  test (`src/lib/catalog/catalog.test.ts`) green.
- **Don't** commit `dist/`, `*.tsbuildinfo`, `.env*` (except `.env.example`), `node_modules/`, or
  `.card-request/`. **Don't** add a backend — this app is intentionally client-only.
