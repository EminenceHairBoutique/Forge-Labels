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
- Every object carries `printLayer` (default `"artwork"`; assignable in the
  properties panel), which drives the separations export — a group's
  non-artwork layer applies to its descendants unless a child overrides it
  (`src/lib/print/layers.ts`).
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
  with vector crop marks. Predictable and pixel-identical to the editor by
  construction; the default for print delivery.
- **Hybrid vector PDF** (`vector-paths.ts` → `vector-doc.ts` →
  `pdf-vector.ts` → `pdf-vector-export.ts`): shapes, outlined text, and
  QR/barcodes as true PDF paths. `vector-paths.ts` holds the pure path
  builders **shared byte-for-byte with the SVG exporter** — one geometry
  source, two serializers. `planVectorDoc` classifies each object:
  vector-expressible → a center-origin path element (group transforms
  flattened through the same math as ungroup); everything pdf-lib can't
  express (gradients, finishes, shadows, images, QR logos) → a tightly
  cropped 600-DPI raster tile rendered by the ordinary stage pipeline.
  Z-order interleaves tiles and paths by index; the dialog reports exactly
  which objects rasterized and why. `drawSvgPath` quirks (implicit y-flip,
  matrix composition, stroke-over-fill ordering) are confined to
  `pdf-vector.ts`.
- **Separations** (`separations.ts`): one 600-DPI PNG per print layer in
  use (artwork keeps the background; spot layers render on transparency via
  `filterDocumentToLayer`), zipped with a manifest and press-notes README.
- **TIFF** (`src/app/api/export/tiff/route.ts`): the client renders the
  usual DPI-exact PNG and a nodejs route transcodes it with sharp (LZW,
  density metadata). Pure byte transform — size-capped, no auth, works in
  local mode.
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

### Batch export — `src/lib/batch/`

`{{column}}` tokens in text, QR values, and barcode values are content, not
schema — extraction (`tokens.ts`) walks the tree, substitution is pure with
structural sharing, and unknown tokens stay literal. `csv.ts` is an RFC-4180
state machine (BOM, quoted fields, embedded newlines, `;` sniffing, ragged
rows padded with per-row errors) capped at 300 rows. `generate.ts` renders
each row through the ordinary raster exporter and streams entries into a
STORE-mode fflate ZIP (PNGs don't recompress; ~1× memory), with per-row
validation (`validate.ts`: QR encodability, barcode check digits), progress,
abort, size warnings, and a trailing manifest + README. The renderer is
injectable, so the whole engine is node-testable. Entitlement gating
(`src/lib/billing/entitlements.ts`) is advisory UX — local mode gets an
all-enabled demo resolver, cloud reads the subscriber's plan row.

## AI assistant — `src/lib/assistant/`

Key-gated (`ANTHROPIC_API_KEY`) and split down the trust boundary:

- **Server** (`server.ts`, `src/app/api/assistant/route.ts`): owns the key,
  the stable cache-friendly system prompt, and the tool definitions; proxies
  exactly one model round per POST with same-origin, cloud-auth, rate-limit,
  and body-size rails. The client can never inject tools or system text.
- **Client executor** (`executor.ts`, `execute.ts`): drives the tool loop —
  POST, execute every `tool_use` block against the live document, reply with
  one `tool_result` message, repeat (≤8 rounds, then a forced no-tools
  summary). All 16 tools validate with the same zod schemas that generate
  the wire JSON schemas (`tools.ts`), clamp numeric input, and return
  directive error strings the model can self-correct from.
- **Undo contract:** the whole turn wraps in one lazy gesture on the command
  bus — principle 4 paying out — so an assistant turn undoes like any other
  edit. Thinking blocks round-trip verbatim; histories trim without
  orphaning tool calls; the document never goes over the wire raw (a capped
  0.1 mm-rounded summary does, `summarize.ts`).

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
  (`get_shared_project`) rather than anon table grants; the share dialog
  and the public `/share/[token]` page are its consumers.
- Invitees can't read `team_invitations` under RLS (only org admins can),
  so `POST /api/team/accept` validates tokens and writes memberships with
  the service role after pure-function checks (`src/lib/teams-accept.ts`).
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
  semantics, migration, imposition + CSV parsing (fast-check properties),
  preflight rules, QR/barcode validity, SVG exporter (glyph paths), vector
  PDF planning/serialization, batch tokens + ZIP generation, effective
  print layers, entitlements matrix, invitation acceptance logic, assistant
  executor (undo semantics, clamps, budget, abort) and route contract
  (mocked SDK), finishes determinism, template application.
- **E2E (Playwright, production build):** byte-level export goldens (PNG
  IHDR dimensions + pHYs, PDF TrimBox, SVG physical units, vector-PDF
  XObject counts, TIFF magic bytes, separations/batch ZIP entries), editor
  flows (undo, autosave reload, templates, QR warnings), **editor↔export
  pixelmatch parity**, local-mode honesty states (billing, teams, sharing,
  assistant), accessibility basics (skip links, labeled toolbar), and a
  100+-object perf smoke.
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → unit → build,
  then the e2e job against the built app.
