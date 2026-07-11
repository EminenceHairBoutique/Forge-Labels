# Production readiness

Checklist for taking a Forge Labels deployment live. Feature gaps are
tracked in [deferred.md](./deferred.md); print-side verification is in
[PRINT-ACCURACY.md](./PRINT-ACCURACY.md).

## Code quality gates

All gates must pass locally and in CI before deploying:

| Gate | Command |
| --- | --- |
| Lint | `npm run lint` (`eslint .`) |
| Types | `npm run typecheck` (`tsc --noEmit`, strict) |
| Unit tests | `npm test` (`vitest run`; geometry, exports, commands are property/unit tested) |
| E2E | `npm run test:e2e` (`playwright test`) |
| Build | `npm run build` (`next build`) |

CI (`.github/workflows/ci.yml`) runs two jobs on every push and PR: a
`checks` job (lint, typecheck, unit tests, build, uploading the `.next`
build) and an `e2e` job that runs Playwright Chromium against that build.
E2E coverage (`tests/e2e/`): project creation with a dimension-accurate
canvas, editing/undo/autosave, PNG export with exact pixel dimensions,
template rescaling, QR preflight warnings, vector SVG with outlined text,
print-ready PDF, editor-to-export pixel parity (pixelmatch), editor
responsiveness with 100+ objects, local-mode UI states, accessibility
basics (skip link, landmarks, labeled toolbar), marketing pages, and the
label calculator.

## Local mode vs cloud mode

The UI branches on the storage adapter's `capabilities`
(`src/lib/storage/types.ts`), never on env vars directly, so features appear
only where they work. Variable names below are exactly as in `.env.example`.

**Zero env vars (local demo mode).** The full editor, calculator, templates,
finishes, preflight, all exports, the 3D mockup, brand kits, and version
history work; projects persist in the browser via IndexedDB. No accounts,
sync, sharing, or billing.

**Supabase set** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`):
accounts (email/password + Google OAuth), cloud-synced projects, assets and
fonts in Storage buckets, and the role-gated admin dashboard.
`SUPABASE_SERVICE_ROLE_KEY` is additionally required by the Stripe
webhook/billing routes.

**Stripe set** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`NEXT_PUBLIC_STRIPE_ENABLED=1`): checkout, the customer portal, and the
webhook activate; the adapter reports `billing: true` only when
`NEXT_PUBLIC_STRIPE_ENABLED === "1"`.

## Security review

- **RLS everywhere.** `supabase/migrations/0001_init.sql` enables row-level
  security on every application table (24 tables, from `profiles` to
  `admin_settings`) and on the Storage buckets, whose object keys are
  namespaced `{uid}/...` and policy-checked.
- **No self-promotion to admin.** `user_roles` has a select policy only —
  no insert/update/delete policies — so roles are writable solely by the
  service role; `is_admin()` is a security-definer function.
- **Service-role key never reaches the client.**
  `src/lib/supabase/service.ts` begins with `import "server-only"`, making
  any accidental client import a build error.
- **Stripe webhook.** `/api/stripe/webhook` verifies the signature against
  the raw body (`constructEventAsync`) and is idempotent via first-insert-wins
  on the `stripe_events` ledger; it is the only writer of subscription state.
- **SVG uploads sanitized at ingest.** `src/lib/images/upload.ts` runs
  DOMPurify over SVG files (scripts, foreignObject, event handlers stripped)
  before they are stored.
- **Share tokens.** `get_shared_project(token)` is a security-definer RPC
  returning a sanitized payload; anon users get no direct table access.
- **Secrets in bundles.** Only `NEXT_PUBLIC_*` values are client-visible:
  the Supabase URL and anon key (safe by design — RLS enforces access) and
  the Stripe-enabled flag. Verify no other secret gains a `NEXT_PUBLIC_`
  prefix during setup.

## Performance notes

- **Editor.** The Konva stage uses three layers
  (`src/components/editor/editor-canvas.tsx`): a non-listening static base
  (label paper/background), the interactive content layer, and an overlay
  for guides, marquee, and the transformer — so chrome never redraws with
  content. Undo is gesture-batched (`beginGesture`/`endGesture` in
  `src/lib/document/commands.ts`): one history entry per drag, not per frame.
- **Finishes.** Simulated materials are procedural 512 px seamless pattern
  tiles (`src/lib/finishes/patterns.ts`) applied as Konva
  `fillPatternImage` — no per-frame filters or shaders.
- **Export memory.** Sheet PDFs embed the label PNG once and draw it per
  cell as a reused XObject (`src/lib/export/sheet-pdf.ts`), so a 30-up
  600-DPI sheet costs one image and no full-sheet canvas ever exists.
  Raster export renders on a detached stage and releases image bitmaps
  after use.
- **Bundles.** The editor shell and the Three.js mockup load via
  `next/dynamic`, keeping marketing and dashboard routes light.

## Accessibility status

- Full keyboard editing: shortcuts for clipboard, duplicate, group/ungroup,
  undo/redo, and arrow-key nudging
  (`src/components/editor/hooks/use-editor-shortcuts.ts`).
- Global `:focus-visible` styles and a skip link on marketing and studio
  layouts (`src/components/ui/skip-link.tsx`).
- `prefers-reduced-motion` is honored globally (`src/app/globals.css`) and
  disables mockup auto-rotation.
- Editor controls carry ARIA labels; canvas objects are reachable
  non-visually through the layers panel, where each object has labeled
  select/reorder/visibility/lock actions
  (`src/components/editor/sidebar/layers-panel.tsx`). The Konva canvas
  itself is a drawing surface, not a DOM tree.

## Known limitations

- Print finishes and substrates are on-screen simulations; physical results
  differ. Order a proof (see [PRINT-ACCURACY.md](./PRINT-ACCURACY.md)).
- PDF export embeds raster artwork in exact-dimension boxes; it is not a
  full vector PDF (deferred — see [deferred.md](./deferred.md)).
- CI exercises local mode only. Cloud paths (RLS behavior, OAuth, Stripe
  end-to-end) need a live Supabase project and Stripe account to verify —
  the walkthrough is in [SETUP.md](./SETUP.md).

## Launch checklist

1. Set the environment variables from `.env.example` in the host
   (Supabase pair + service key, Stripe pair + `NEXT_PUBLIC_STRIPE_ENABLED`).
2. Apply `supabase/migrations/0001_init.sql` (tables, RLS, functions,
   Storage buckets) then `0002_seed.sql` (plans, template categories) to
   the Supabase project.
3. Grant the first admin directly in SQL — RLS forbids the client path:
   `insert into public.user_roles (user_id, role) values ('<auth-user-uuid>', 'admin');`
4. Sign in as that admin and seed templates from the code registry via
   `/admin` ("Seed from code registry").
5. Configure Google OAuth in Google Cloud and Supabase Auth for the
   production domain.
6. Create Stripe products/prices and write the price IDs into
   `plans.stripe_price_monthly` / `plans.stripe_price_yearly`.
7. Point a Stripe webhook at `/api/stripe/webhook` for
   `checkout.session.completed` and `customer.subscription.created/updated/deleted`,
   and set its signing secret as `STRIPE_WEBHOOK_SECRET`.
8. Smoke-test checkout and the portal in Stripe test mode; confirm a
   `subscriptions` row appears and a replayed event is acknowledged as a
   duplicate.
9. Set up scheduled database backups (and Storage bucket backups) in
   Supabase before announcing availability.
