# Deferred features

The honest ledger of everything the product spec calls for that this build
intentionally defers. Each row records why it waits, what ships instead, and
the accommodation already in the codebase so the feature lands without
rework. Sequencing lives in [ROADMAP.md](./ROADMAP.md).

## Product features

| Feature | Why deferred | What ships today instead | Architectural accommodation already in place |
| --- | --- | --- | --- |
| CSV batch and dynamic text fields | Batch UX (column mapping, per-row preflight, bulk export) is a large surface | Duplicate a project and edit per unit; ZIP bundles one design in every format | Typed command bus (`src/lib/document/commands.ts`); `csvBatch` entitlement flag in `src/lib/billing/plan-seed.ts`; text content is a plain zod-validated string, and `schemaVersion` + `src/lib/document/migrate.ts` gate the future token-syntax change |
| Print-production layers UI (white ink, varnish, foil separations) | Per-layer export and press dialects need printer-partner validation | Simulated finish fills and substrate previews; preflight `white-ink-needed` warning | Every object stores `printLayer` (default `"artwork"`) via the 10-value `PrintLayerSchema` in `src/lib/document/schema.ts` — saved documents need no migration |
| Team collaboration UI | Membership, roles, and invite flows are meaningless without email delivery (below) | Single-user accounts in cloud mode | `organizations`, `organization_members`, `team_invitations` tables with RLS plus `is_org_member()`/`org_role_rank()` in `supabase/migrations/0001_init.sql`; `maxTeamMembers` entitlement |
| Share-link UI | Link management (expiry, revocation, edit mode) deferred with the team surface | Export files and send them | `shared_links` table and `get_shared_project(token)` security-definer RPC (anon-executable, sanitized payload); adapter `capabilities.sharing` is `false`, so the UI gate already exists (`src/lib/storage/types.ts`) |
| AI design assistant | Model integration and safety review out of scope for this build | Manual editing, templates, brand kits | Every document mutation flows through typed commands (`src/lib/document/commands.ts`), the declared integration point — assistant edits become undoable commands |
| Print fulfillment integration | Requires a fulfillment partner and order/payment plumbing | Print-ready PDFs, imposition sheets, and the [pre-print checklist](./PRINT-ACCURACY.md) | `export_jobs` table and export-history records (format, DPI, byte size) |
| Background removal | Needs a segmentation model or paid API | Image crop, fit modes, and filters | Filter pipeline (`src/lib/render/image-filters.ts`) is applied identically in editor and exports; assets adapter stores processed variants |
| TIFF export | Requires server-side image processing (sharp); this build is client-rendered | 600-DPI PNG with pHYs, print-ready PDF | `exportRaster` (`src/lib/export/raster.ts`) already emits DPI-exact bitmaps a server route could transcode |
| Apple sign-in | Requires an Apple Developer account and domain verification | Email/password and Google OAuth in cloud mode | Supabase `signInWithOAuth` flow already wired in `src/components/auth/auth-forms.tsx` |
| MFA | Enrollment/recovery UX deferred | Password and OAuth sessions | Cloud auth is Supabase Auth, which supports MFA without schema changes |
| Full vector-PDF mode | Faithful vector output of gradients, finishes, and shadows in PDF needs its own compositor | PDF embeds a 600-DPI raster in exact-dimension TrimBox/BleedBox pages | Glyph-outline and vector QR/barcode machinery exists in `src/lib/export/svg.ts`; `src/lib/export/pdf.ts` confines all pdf-lib usage so the backend can be swapped |
| Text auto-fit UI | Interacts with curved text and live measurement; needs careful UX | Manual font sizing with live height measurement (`src/lib/render/text-measure.ts`) | `autoFit` field already stored on every text object (`TextObjectSchema`, default `false`) |
| Multi-panel (front+back) canvases | A true multi-canvas document is a schema and editor change | The calculator's `front-back` style sizes one panel and reports `panels: 2`; design each panel as its own project | `LabelCalcResult.panels` already models panel count; `schemaVersion` migration chain absorbs the document change |
| Email sending for team invites | No transactional-mail provider is configured | Nothing (no team UI either) | `team_invitations.token` (unique, random) is generated at insert; only delivery is missing |

## Operational gaps (cannot be verified in this repo alone)

These need real infrastructure and belong on the
[production-readiness checklist](./PRODUCTION-READINESS.md):

- **Live Stripe webhook end-to-end.** The handler verifies signatures and is
  idempotent via `stripe_events`, but the full loop (checkout → webhook →
  subscription row) must be exercised against a real Stripe account in test
  mode; it has no automated coverage in this repo.
- **Supabase RLS behavior against a live project.** Policies ship in
  `supabase/migrations/0001_init.sql`; confirm them against a running
  Supabase instance with two test users (CI runs local mode only).
- **Google OAuth app registration.** The button and flow exist; the OAuth
  client, consent screen, and redirect URLs must be configured in Google
  Cloud and Supabase Auth for the production domain.
