# Architecture

## Principles

1. **Millimeters are canonical.** Documents, geometry, and print math are
   mm end-to-end; screen pixels exist only at the view layer. One kernel —
   `src/lib/geometry/units.ts` — owns every conversion:
   screen px = mm × zoom · raster px = mm ÷ 25.4 × DPI · PDF pt = mm × 72 ÷ 25.4.
2. **One render mapping.** The editor and every exporter consume the same
   object→Konva configuration (`src/lib/render/node-configs.ts`), so WYSIWYG
   is structural, not aspirational. An e2e pixelmatch test
   (`tests/e2e/parity.spec.ts`) enforces it.
3. **Honest capability gating.** UI branches on an adapter-provided
   `capabilities` object, never on raw env vars; missing backends produce
   explanatory states, never fake buttons.
4. **All document mutations flow through typed commands** — which is what
   makes undo, autosave dirty-checking, and a future AI assistant (emitting
   the same commands) cheap.

## Document model — `src/lib/document/`

`schema.ts` defines a versioned Zod schema. A `LabelDocument` holds
`schemaVersion`, the vial geometry, label geometry
(width/height/bleed/safe/corner radius/shape), a background, a substrate id,
and `objects[]` — a discriminated union of
`text | rect | ellipse | line | polygon | star | image | qrcode | barcode | group`.

Conventions that everything downstream relies on:

- Positions are **object centers** (`xMm`, `yMm`) with rotation about the
  center — resize/rotate math and alignment stay symmetric.
- **Z-order is array order.** No z-index field to drift out of sync.
- Every object carries `printLayer: "artwork"` (forward-compatibility for
  white-ink/varnish separations) and may carry a `finish`.
- `migrateDocument()` (in `migrate.ts`) upgrades any stored document to the
  current `schemaVersion` on load; adapters call it on every read.

`commands.ts` is the single mutation gateway (`mutateDocument`), with
`beginGesture`/`endGesture` around continuous interactions; `defaults.ts`
builds documents (via the label calculator) and objects;
`structure-commands.ts` handles group/ungroup (re-basing child transforms)
and align/distribute.

## Editor state — `src/stores/`

Three stores with strict separation:

- `document-store.ts` — **only** the `LabelDocument`, wrapped in zundo's
  temporal store for undo/redo.
- `editor-ui-store.ts` — selection, tool, zoom/pan, snap/guide/ruler
  toggles, text-editing id. Never in history: undoing must not teleport the
  viewport.
- `auth-store.ts` — auth status + user + admin flag.

**One undo entry per gesture:** the first mutation of a gesture runs tracked
(pushing the pre-gesture snapshot), then the temporal store pauses while the
gesture streams (drag, slider, typing), and resumes on release. Canvas drags
commit nothing until `dragend`/`transformend` — Konva moves nodes visually,
then the final mm values land as a single command. Transforms bake
`scaleX/Y` into `widthMm`/`heightMm` (font size for text) and reset scale to
1, so scale never accumulates in the document.

## Rendering pipeline — `src/lib/render/`

- `node-configs.ts` — pure functions mapping each object type to Konva
  props: text metrics (weight→`fontStyle`, letter-spacing in em,
  half-leading baseline), curved-text path data, image fill/cover/contain
  layout, center-origin shapes.
- `fills.ts` — solid/linear-gradient/finish fills to Konva props;
  finish fills resolve through a registered pattern resolver.
- `build-stage.ts` — builds a detached Konva stage **in mm units** for
  export: options for bleed inclusion, die-cut clipping, and background.
- The interactive editor (`src/components/editor/`) renders the same
  configs through react-konva with a three-layer stage: static base
  (non-listening), content, overlay (guides/transformer/marquee). Pan/zoom
  live on a scaled Group — the stage itself stays unscaled so transformer
  anchors and hairline guides keep constant screen size.

### Exports — `src/lib/export/`

- **Raster** (`raster.ts`): the mm-unit stage rendered at
  `pixelRatio = dpi / 25.4`, then enforced to exactly
  `round(mm ÷ 25.4 × dpi)` pixels. PNGs get a `pHYs` physical-DPI chunk
  (`png-dpi.ts`); JPGs composite over white.
- **PDF** (`pdf.ts`): raster-in-exact-dimension strategy — art embedded as a
  600-DPI PNG inside MediaBox/BleedBox/TrimBox computed in points from mm,
  with vector crop marks. Rationale: the maintained pdf-lib fork has no
  gradient/shading API, so most real labels would rasterize anyway; a hybrid
  vector path would mean two render paths to keep pixel-identical. The SVG
  exporter's glyph-outline machinery is the on-ramp to a future full-vector
  mode (see `deferred.md`).
- **Sheets** (`sheet-pdf.ts`): the label is rasterized **once**, embedded
  once, and drawn N times (PDF XObject reuse) — a Letter sheet at 600 DPI
  as a single canvas would exceed iOS's ~16.7 MP canvas cap. Includes cut
  lines/crop marks per cell and a calibration page (two 100 mm bars +
  rulers) whose measured error feeds saved X/Y offsets.
- **SVG** (`svg.ts`): true vector — shapes as paths, text outlined to glyph
  paths via fontkit (kerning and Konva's half-leading baseline reproduced),
  QR/barcodes as vector paths. Injectable font/image loaders keep it
  testable in Node.
- **Imposition** (`src/lib/print/imposition.ts`): pure grid math
  (rows/cols, centering, spacing, start-at offsets, calibration shifts),
  property-tested with fast-check against overlap and bounds invariants.

## Finishes — `src/lib/finishes/`

Twelve simulated finishes (holographic variants, foils, brushed metal,
chrome, glitter, matte/gloss…) are **deterministic, seamlessly tiling
canvas tiles** (seeded PRNG, cached per id+intensity). The same generator
serves the editor and exports at a fixed density (12 px/mm), so screen and
output match by construction. Runtime shaders/filters are deliberately
banned — they would break export parity. Substrates (white/clear/kraft/
metallic stock) preview behind transparent backgrounds and drive preflight
advisories. The UI labels all of this as simulation.

## Codes — `src/lib/codes/`

QR: `qrcode` generates the matrix; a custom renderer draws modules
(square/rounded/dot) with quiet zone and optional center logo knockout, and
`qrModuleSizeMm` feeds the ≥0.4 mm scannability rule. Barcodes: bwip-js
(Code 128/39, EAN-13, UPC-A, DataMatrix) with GS1 check-digit
validation/normalization in `validate.ts`.

## Preflight — `src/lib/preflight/rules.ts`

Pure functions over the document: font-size floors, image DPI at placed
size, safe-zone/bleed violations, QR module size and quiet zone, barcode
check digits, low contrast, white-ink-on-clear advisory. Each issue carries
`ruleId`, severity, and the offending `objectId` so the panel can
click-to-select. Running before export is the default path in the dialog.

## Storage — `src/lib/storage/`

`StorageAdapter` is the seam: projects, versions, assets, brand kits, export
history, plus a `capabilities` object (`mode`, `auth`, `cloudSync`,
`billing`, `sharing`).

- `local.ts` — IndexedDB (via `idb`): full persistence with zero config;
  versions capped per project.
- `supabase-adapter.ts` — the same interface over Postgres + Storage under
  RLS; assets live in the private `user-assets` bucket keyed `{uid}/{id}`.

`AuthProvider` swaps the adapter with the session: no Supabase env →
permanent local mode; signed out → local adapter (guests keep the full
editor); signed in → Supabase adapter, with a one-shot local→cloud import
offer.

## Supabase — `src/lib/supabase/`, `supabase/migrations/`

Browser singleton, SSR server client (Next 16 async `cookies()`, the
`getAll`/`setAll` contract), and a `server-only` service-role client.
`src/proxy.ts` refreshes sessions.

Schema/RLS decisions worth knowing:

- `user_roles` has **no authenticated write policies** — only the service
  role writes it, so users can't self-promote to admin.
- `owner_id` is denormalized onto child tables (versions, assets, brand
  kits) for index-friendly policies.
- Templates are readable when `published` (or admin); plans and categories
  are anon-readable so pricing renders pre-auth.
- `subscriptions` has zero authenticated write policies — the Stripe
  webhook (service role) is the only writer.
- Share links resolve through a `security definer` RPC
  (`get_shared_project`) rather than anon table grants; the sharing UI
  itself is deferred.
- Storage buckets enforce `{uid}/` folder ownership plus size/MIME limits.

## Stripe — `src/app/api/stripe/`

Checkout and portal routes resolve price IDs from the `plans` table
(pricing is data). The webhook verifies signatures, records every event id
in `stripe_events` first (insert-returning; the row is deleted if processing
fails so Stripe's retry re-runs it), and upserts subscription state.

## 3D mockup — `src/components/mockup/`

The label is its own open cylinder segment: radius = vial radius + 0.12 mm,
`thetaLength = labelWidth ÷ circumference × 2π` — so arc length **is** the
physical label width and the seam/gap is visible at true scale. Glass is
`MeshPhysicalMaterial` transmission with tint presets; liquid and cap are
separate meshes. The label texture is the shared offscreen renderer output
(≤2048 px, ~300 ms trailing throttle) on a demand-driven frameloop. The HDR
environment is generated locally (`scripts/generate-hdr.mjs`) — no CDN
fetches. The landing hero defers loading until idle and falls back to SVG
when WebGL or motion is unavailable.

## Testing

- **Unit (Vitest):** geometry/calculator, document commands + undo
  semantics, migration, imposition (fast-check properties), preflight
  rules, QR/barcode validity, SVG exporter (glyph paths), finishes
  determinism, template application.
- **E2E (Playwright, production build):** byte-level export goldens (PNG
  IHDR dimensions + pHYs, PDF TrimBox, SVG physical units), editor flows
  (undo, autosave reload, templates, QR warnings), **editor↔export
  pixelmatch parity**, local-mode honesty states, accessibility basics
  (skip links, labeled toolbar), and a 100+-object perf smoke.
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → unit → build,
  then the e2e job against the built app.
