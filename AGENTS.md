<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Forge Labels — working notes

Vial-label design studio: Next.js 16 App Router, React 19, strict
TypeScript, Tailwind v4 (CSS-first `@theme` in `src/app/globals.css`),
react-konva editor, optional Supabase/Stripe. Full design rationale:
`docs/ARCHITECTURE.md`.

## Commands

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` · `npm run typecheck` · `npm test` (Vitest) ·
  `npm run test:e2e` (Playwright; needs `npm run build` first — the web
  server runs `next start` on port 3100)

## Load-bearing invariants (do not break)

1. **Millimeters are canonical.** Documents never store screen pixels. All
   conversions go through `src/lib/geometry/units.ts`. Exports must stay
   DPI-exact — `tests/e2e/editor.spec.ts` asserts byte-level PNG/PDF
   dimensions and will fail on drift.
2. **One render mapping.** Editor and exporters share
   `src/lib/render/node-configs.ts`. Never add a visual feature to the
   editor without it flowing through the shared configs — `tests/e2e/parity.spec.ts`
   pixelmatches the live canvas against the exported PNG.
3. **All document mutations go through `src/lib/document/commands.ts`**
   (`mutateDocument`, gesture helpers). Never `setState` the document
   directly; undo semantics (one entry per gesture) depend on it.
4. **Capability gating, not env sniffing.** UI branches on the storage
   adapter's `capabilities` object. Missing backends get explanatory
   states — never fake buttons, never dead ends.
5. **Schema changes bump `schemaVersion`** in `src/lib/document/schema.ts`
   with a migration step in `migrate.ts`.
6. **Pricing lives in the database** (`plans` table, seeded from
   `src/lib/billing/plan-seed.ts` + `supabase/migrations/0002_seed.sql` —
   keep the two in sync). Plan highlights must only claim shipped features;
   deferred ones are marked "(in development)".
7. **Secrets:** `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, and
   `ANTHROPIC_API_KEY` are server-only (`server-only` import guards). Never
   expose them or write subscription state from the client.
8. **One vector geometry source.** `src/lib/export/vector-paths.ts` feeds
   BOTH the SVG exporter and the hybrid vector PDF. Change a path builder
   and `svg.test.ts` must stay byte-identical; pdf-lib quirks (y-flip,
   matrix composition) stay confined to `pdf-vector.ts`.
9. **Batch tokens are content, not schema.** `{{column}}` placeholders live
   inside plain string fields; `TOKEN_RE`/substitution in `src/lib/batch/tokens.ts`
   are the single definition, and unknown tokens stay literal.
10. **The assistant edits ONLY through its typed tools**
    (`src/lib/assistant/tools.ts` → `execute.ts` → the command bus), one
    gesture per turn. The route owns the API key, system prompt, and tool
    defs — clients can never inject them; the raw document never goes over
    the wire (capped summary only).
11. **Layer semantics:** a group's non-artwork `printLayer` applies to its
    descendants unless a child overrides (`src/lib/print/layers.ts`) —
    separations, the layers-panel badges, and preflight all assume it.

## Gotchas discovered in this codebase

- React 19 + new react-hooks lint rules: no synchronous `setState` in
  effects (use the adjust-during-render pattern or `useSyncExternalStore`),
  no ref reads during render.
- R3F v9 augments JSX globally; typing polymorphic `icon:` props as
  `React.ElementType` collapses to `never` — use `LucideIcon` instead.
- Konva sets `window.Konva`; the e2e parity test relies on it.
- zundo: read temporal state via
  `useStore(useDocumentStore.temporal, selector)`.
- Playwright in the sandbox uses the preinstalled Chromium at
  `/opt/pw-browsers/chromium` (wired in `playwright.config.ts` when `!CI`).
  If editor e2e fails with stale chunks, kill leftover servers:
  `pkill -f "next[-]server"` (bracket avoids self-match).
- Fictional template brands only; finishes are labeled simulations.

## Docs map

`docs/SETUP.md` (Supabase/Stripe wiring) · `docs/DEPLOYMENT.md` ·
`docs/ARCHITECTURE.md` · `docs/PRINT-ACCURACY.md` ·
`docs/PRODUCTION-READINESS.md` · `docs/ROADMAP.md` · `docs/deferred.md`
(the honest ledger — update it whenever scope is cut).
