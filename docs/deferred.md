# Deferred features

The honest ledger of everything the product spec calls for that this build
intentionally defers. Each row records why it waits, what ships instead, and
the accommodation already in the codebase so the feature lands without
rework. Sequencing lives in [ROADMAP.md](./ROADMAP.md).

## Product features

| Feature | Why deferred | What ships today instead | Architectural accommodation already in place |
| --- | --- | --- | --- |
| Print fulfillment integration | Requires a fulfillment partner and order/payment plumbing | Print-ready PDFs, TIFF, separations, imposition sheets, and the [pre-print checklist](./PRINT-ACCURACY.md) | `export_jobs` table and export-history records (format, DPI, byte size) |
| Background removal | Needs a segmentation model (a 40–80 MB WASM dependency) or a paid API — rejected for zero-config installs | Image crop, fit modes, and filters | Filter pipeline (`src/lib/render/image-filters.ts`) is applied identically in editor and exports; assets adapter stores processed variants |
| Text auto-fit UI | Interacts with curved text and live measurement; needs careful UX | Manual font sizing with live height measurement (`src/lib/render/text-measure.ts`) | `autoFit` field already stored on every text object (`TextObjectSchema`, default `false`) |
| Multi-panel (front+back) canvases | A true multi-canvas document is a schema and editor change | The calculator's `front-back` style sizes one panel and reports `panels: 2`; design each panel as its own project | `LabelCalcResult.panels` already models panel count; `schemaVersion` migration chain absorbs the document change |
| Email sending for team invites | No transactional-mail provider is configured | Invite LINKS: the team page generates the tokened URL and you deliver it yourself (the UI says so) | `team_invitations.token` (unique, random) is generated at insert; only delivery is missing |
| Assistant image/finish tools | Image edits need uploads and finish fills need visual pickers — poor fits for text tool calls | The AI assistant points to the right UI spot; all other object types are fully editable via tools | Tool registry (`src/lib/assistant/tools.ts`) is data-driven — new tools are one entry + one handler |

Shipped since the first build (previously in this table): CSV batch +
dynamic fields, production layers + separations export, team collaboration
UI, share links, hybrid vector PDF, TIFF export, the AI design assistant
(key-gated), MFA, and the Apple sign-in flag — see
[ROADMAP.md](./ROADMAP.md) for where each landed.

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
- **Apple sign-in provider.** The flag-gated button exists
  (`NEXT_PUBLIC_AUTH_APPLE=1`); Apple Developer registration and the Supabase
  provider config cannot be exercised here.
- **MFA against live Supabase Auth.** Enrollment, challenge, and unenroll ship
  code-complete, but TOTP flows need a real GoTrue instance — verify with the
  steps in [SETUP.md](./SETUP.md).
- **Assistant with a live API key.** CI proves the no-key gate, the guard
  rails, and the executor loop against a mocked SDK; one manual smoke test
  with a real `ANTHROPIC_API_KEY` (steps in [SETUP.md](./SETUP.md)) confirms
  end-to-end wiring.
- **Share links and team flows against live RLS.** Local-mode CI verifies the
  honest gates; link resolution, invite acceptance, and org-scoped project
  visibility need a running Supabase project with two test users.
