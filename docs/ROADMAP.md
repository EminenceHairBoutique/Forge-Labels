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

## Phase 2 — Next (unblocks production printing workflows)

- **CSV batch and dynamic text fields.** Generate a labeled run (lots,
  serials, per-row QR payloads) from a CSV.
  Hook: all document mutations already flow through typed commands
  (`src/lib/document/commands.ts`), the ZIP export pipeline exists, and the
  `csvBatch` entitlement flag is already modeled in `src/lib/billing/plan-seed.ts`.
- **Share-link UI.** Create view/edit links to a project.
  Hook: `shared_links` table and the `get_shared_project` security-definer
  RPC ship in `supabase/migrations/0001_init.sql`; the storage adapter's
  `capabilities.sharing` flag (currently `false`) already gates the UI.
- **Team collaboration UI.** Organizations, roles, and invitations.
  Hook: `organizations`, `organization_members`, and `team_invitations`
  tables with RLS and the `is_org_member()`/`org_role_rank()` helpers are
  already migrated; `maxTeamMembers` is an existing plan entitlement.
- **Print-production layer UI.** Assign objects to white-ink, varnish, foil,
  and other separations and export per-layer files.
  Hook: every object already stores `printLayer` (default `"artwork"`) via
  `PrintLayerSchema` in `src/lib/document/schema.ts`, so documents saved
  today need no migration; preflight already warns when clear/metallic stock
  needs white ink.
- **Full vector PDF mode.** Today's PDFs embed a 600-DPI raster in
  exact-dimension boxes; a vector mode would draw shapes and outlined text
  directly.
  Hook: `src/lib/export/svg.ts` already converts text to glyph outlines with
  fontkit and emits vector QR/barcodes; `src/lib/export/pdf.ts` deliberately
  confines all pdf-lib usage so the compositor can be swapped.

## Phase 3 — Later

- **AI design assistant.** Conversational edits to the open document.
  Hook: the command bus in `src/lib/document/commands.ts` is the single
  mutation path — an assistant emits the same typed commands, so its changes
  are undoable like any manual edit.
- **Print fulfillment integration.** Order physical labels from inside the app.
  Hook: the `export_jobs` table and per-export history records (format, DPI,
  byte size) already exist to anchor an order pipeline.
- **Background removal for images.** One-click subject isolation.
  Hook: the image filter pipeline (`src/lib/render/image-filters.ts`) is
  applied identically in the editor and every export, and processed variants
  can be stored through the existing assets adapter.
- **TIFF export.** Print shops occasionally require TIFF; this needs
  server-side image processing (sharp), which this build does not run.
  Hook: `exportRaster` already produces DPI-exact bitmaps suitable for a
  server-side transcode route.
- **Apple sign-in.** Hook: the Supabase OAuth flow used for Google in
  `src/components/auth/auth-forms.tsx` extends to additional providers with
  provider registration plus one button.
- **MFA.** Hook: cloud mode authenticates through Supabase Auth, which
  supports MFA enrollment without schema changes.
