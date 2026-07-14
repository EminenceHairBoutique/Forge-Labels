# Roadmap

Phases are ordered by what unblocks real print production first. Everything
listed as deferred here is tracked in detail in [deferred.md](./deferred.md).
Dimensional guarantees are documented in [PRINT-ACCURACY.md](./PRINT-ACCURACY.md);
deployment steps in [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md).

## Phase 1 — Shipped (this build)

**Vial label calculator.** All six label styles (`full-wrap`, `partial-wrap`,
`front-only`, `front-back`, `neck-band`, `cap-circle`) computed as pure,
unit-tested mm math in `src/lib/geometry/label-calculator.ts`, with seam,
curvature, and wall-height guidance.

**Canvas editor.** react-konva editor with text (curved text, letter spacing),
rect/ellipse/line/polygon/star shapes, images (crop, filters), QR codes
(6 payload types, logo overlay), barcodes (Code 128/39, EAN-13, UPC-A, Data
Matrix), nested groups, smart-guide snapping (`src/lib/editor/snapping.ts`),
keyboard shortcuts with arrow-key nudge, and gesture-batched undo (zundo).

**Template library.** 16 templates across 8 fictional demo brands and 10
categories (`src/lib/templates/registry.ts`); applying one to a different
label size rescales it proportionally.

**Finishes and substrates.** 12 simulated special-material finishes
(holographic, foil, metal, texture) and 6 substrate previews
(`src/lib/finishes/types.ts`). These are on-screen simulations only.

**Preflight engine.** `src/lib/preflight/rules.ts`: bleed/safe-zone checks,
font and hairline minimums, effective image DPI, QR module size and quiet
zone, barcode check digits, contrast, and white-ink advisories.

**Exports.**
- PNG/JPG at 300 or 600 DPI with exact pixel dimensions and a pHYs DPI chunk
  (`src/lib/export/raster.ts`, `png-dpi.ts`).
- Single-label PDF with TrimBox/BleedBox and vector crop marks
  (`src/lib/export/pdf.ts`).
- Imposition sheet PDFs for US Letter, A4, and US Legal with cut lines,
  per-cell crop marks, partial-sheet reuse, a printer calibration page, and
  X/Y calibration offsets (`src/lib/print/imposition.ts`,
  `src/lib/export/sheet-pdf.ts`).
- True-vector SVG with fontkit glyph outlines (`src/lib/export/svg.ts`).
- ZIP bundle of every format (fflate).

**3D vial mockup.** React Three Fiber scene (`src/components/mockup/vial-scene.tsx`)
textured with the live label render; glass color, cap, and liquid fill options.

**Storage.** Local-first IndexedDB adapter with zero configuration, plus an
optional Supabase cloud adapter (auth, RLS, Storage buckets) behind a shared
`StorageAdapter` interface (`src/lib/storage/types.ts`) with projects,
version history, assets, brand kits, and export history.

**Billing scaffolding.** Stripe checkout/portal routes and a signature-verified,
idempotent webhook (`src/app/api/stripe/webhook/route.ts`).

**Operations.** Admin dashboard (template seeding, plans), marketing and legal
pages, and CI running lint, typecheck, unit tests, e2e, and build
(`.github/workflows/ci.yml`).

## Phase 2 — Shipped (production printing workflows)

**CSV batch and dynamic data fields.** `{{column}}` placeholders in text, QR,
and barcode values fill per CSV row (RFC-4180 parser, 300-row cap) and export
as a streamed ZIP with a manifest (`src/lib/batch/`); per-row validation
covers QR encodability and barcode check digits, and preflight downgrades
tokened-value errors to a batch note. Business-plan entitlement, advisory
client-side gate (`src/lib/billing/entitlements.ts`).

**Share links.** Per-project view/copy links with revocation and optional
expiry (`src/lib/sharing.ts`), served on a public read-only page
(`src/app/share/[token]`) through the `get_shared_project` security-definer
RPC. Cloud mode only; local mode explains why.

**Team collaboration.** One organization per owner, roles
(owner/admin/editor/viewer), invite LINKS (no email — stated in the UI),
seat limits from the owner's plan, and project↔team moves
(`src/lib/teams.ts`, `/team`, `POST /api/team/accept` with the service role,
`supabase/migrations/0003_team_ui.sql`).

**Print-production layers.** Per-object layer assignment in the properties
panel (10 layers incl. white ink, foils, spot UV, die-cut), group-inherited
effective layers, per-layer 600-DPI separations ZIP with README/manifest
(`src/lib/print/layers.ts`, `src/lib/export/separations.ts`), and two new
preflight rules (white-ink-on-opaque, die-cut content).

**Hybrid vector PDF.** `pdf-vector` export keeps text (fontkit outlines),
shapes, and QR/barcodes as true vector paths and rasterizes only what PDF
can't express vectorially (gradients, finishes, shadows, images) as tightly
cropped 600-DPI tiles (`src/lib/export/vector-paths.ts`, `vector-doc.ts`,
`pdf-vector.ts`); the export dialog lists exactly what got rasterized.

## Beginner-first UX overhaul — Shipped

The Easy Creator layer (built additively on the same document model):
guided `/create` wizard with visual vial cards and plain-language
measuring, eight beginner materials with reactive previews and intensity
controls, twelve size-responsive layout archetypes driven by a semantic
slot engine (schema v2), a form-based editor with the 3D vial as the
canvas, one-click layout fixes, design variations and dark/light flips,
the matching product-line generator with strength color coding, a
plain-language print wizard with one-click preflight fixes and a printer
specification sheet, "Make my label for me" (one screen → three finished
options), first-run onboarding with a sample project, and a mobile-first
flow verified end-to-end on iPhone/iPad/laptop/desktop viewports. Details:
[EASY-CREATOR-ARCHITECTURE.md](./EASY-CREATOR-ARCHITECTURE.md) and the
user guide in [EASY-CREATOR-GUIDE.md](./EASY-CREATOR-GUIDE.md).

## Template, typography & material overhaul — Shipped

Built on the Easy Creator layer without touching the print kernel:

- **120 validated templates** across the named families of the brief
  (Obsidian Gold, Medical Index, Data Matrix, Prism Frame, Acid Signal,
  Modern Apothecary, Floating Type…), each a size-responsive layout
  program passing an automated quality-gate matrix
  (`npm run validate:templates`): real vial geometries plus edge shapes ×
  stress content × material rules, checking print floors, overlap, QR
  quiet zones, contrast against actual backings, and font references. A
  layout-DNA uniqueness test forbids color-swap padding.
- **38 bundled font families** (9.3 MB of static OFL TTFs, lazily
  loaded), fetched and license-verified by `scripts/fetch-fonts.mjs`, and
  27 curated **font pairings** behind 10 typography personalities — no
  font dropdowns anywhere in Easy mode.
- **Richer layout vocabulary**: split data columns, vertical brands,
  monogram medallions, strength chips, kicker subtitles, corner marks,
  side rails, dividers, gradient/inset/full-bleed bands, effect frames,
  and side/footer-center code placements with honest degradation ladders
  (codes shrink, relocate, or step aside with a plain-language note —
  never overlap).
- **Effect placement controls** ("Where should the effect go?") for
  holographic/metallic/neon with automatic readability protection, and
  "Make it more premium / cleaner / bolder / more clinical / more
  futuristic" one-click actions.
- **Template browser** (`/library` and in-editor): engine-rendered
  mockup cards with the user's own words, lazy cached thumbnails,
  favorites, style/tone/density filters (bottom sheet on phones), and a
  single interactive 3D preview in the detail view.
- **Six-role recommendations** with one-sentence reasons, informed by
  content density, QR/barcode needs, glass color, and label dimensions;
  the wizard asks "What needs to fit?" and the container's glass color.
- **Logo upload in Easy mode** (PNG/JPG → engine-placed, reflowed,
  undoable) and a "Fix contrast" one-click preflight fix.

Details: [TEMPLATE-TYPOGRAPHY-AUDIT.md](./TEMPLATE-TYPOGRAPHY-AUDIT.md)
(the before-state audit),
[EASY-CREATOR-ARCHITECTURE.md](./EASY-CREATOR-ARCHITECTURE.md),
[PERFORMANCE.md](./PERFORMANCE.md), and [ACCESSIBILITY.md](./ACCESSIBILITY.md).

## Phase 3 — Partially shipped

Shipped in this build:

- **AI design assistant (key-gated).** A 4th editor tab chats with Claude and
  edits the document through 16 typed tools over the same command bus — one
  undo entry per assistant turn. Activates when `ANTHROPIC_API_KEY` is set;
  otherwise the tab explains what's missing (`src/lib/assistant/`,
  `POST /api/assistant`).
- **TIFF export.** Server-side PNG→TIFF transcode (sharp, LZW, embedded
  density) at `POST /api/export/tiff`, wired into the export dialog.
- **MFA (TOTP).** Enrollment (QR + verify) and factor management in Settings →
  Security; sign-in challenges for aal2 accounts in the login form. Cloud
  mode only.
- **Apple sign-in (flagged).** `NEXT_PUBLIC_AUTH_APPLE=1` adds the Apple
  OAuth button once the provider is configured in Supabase.

Still later (tracked in [deferred.md](./deferred.md)):

- **Print fulfillment integration.** Order physical labels from inside the
  app. Hook: the `export_jobs` table and per-export history records (format,
  DPI, byte size) already exist to anchor an order pipeline.
- **Background removal for images.** One-click subject isolation. Hook: the
  image filter pipeline (`src/lib/render/image-filters.ts`) is applied
  identically in the editor and every export, and processed variants can be
  stored through the existing assets adapter.
