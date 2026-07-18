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
| SVG logos in Easy Creator | SVG needs sanitization + font handling — the Advanced Editor's asset pipeline does that properly | PNG/JPG/WebP logo upload in Easy (downscaled, engine-placed, reflowed); SVG via the Advanced Editor | `fileToEasyLogo` rejects SVG with a pointer; the Advanced pipeline already sanitizes SVG uploads |
| AI assistant inside Easy Creator | The deterministic variation/fix buttons cover the common commands; chat adds a key-gated dependency to the core beginner flow | "Make it more premium/cleaner/bolder…", pairing cycling, placement chips, dark/light flips, and one-click fixes — all deterministic; the secure assistant remains in the Advanced Editor | The assistant's typed tools and the Easy engine both drive the same command bus — surfacing chat in Easy mode is UI work only |
| Side-by-side variation compare | Snapshot management UX; undo already makes trying variations free | Template favorites persist in the browser (♥); the wizard's pick step and the template browser ARE side-by-side compares | Variations are pure `EasyChange`s — a compare tray is a stored array of them |
| Variant table generator (many strengths at once) | A grid UI over `buildFamilyVariant`; each row is seconds of work today | "Matching label" creates siblings one at a time; Batch export fills `{{tokens}}` per CSV row for print runs | `family.ts` is pure — looping it over table rows is UI work only |
| "Most popular" template section | Real popularity needs usage analytics, which don't exist — a curated list labeled "popular" would be dishonest | A "Featured" section (openly curated) plus per-user favorites | The browser's section list is data-driven; a popularity feed is one sorted query away once analytics exist |
| Paid ("Pro") template gating | Every template ships free today; gating needs a pricing decision plus plan-seed/DB sync (invariant 6) | All 120 templates usable by everyone; the browser's badge shows "Free" honestly | `premium`/`featured` flags exist on every template; the entitlements resolver is the enforcement point |
| iOS tilt-to-shine permission flow | DeviceOrientation on iOS requires a user-gesture permission prompt — intrusive for a decorative effect | Pointer/touch tracking moves the shine on every platform; tilt works where no prompt is needed (Android) | `ReactiveShine` already gates on `requestPermission` presence (and skips sensors under reduced motion) |
| Hosted verification pages (per-batch COA pages served by Forge Labels) | Needs public storage, retention, and identity decisions — a product in itself | QR codes to YOUR verification/COA URL, printed verification codes, catalog/lot/batch fields, and COA references | The `coa`/`verification` slots and export history exist; a hosted page is one route + storage bucket away |
| Admin-configurable research-notice list | Org-level approved wording needs the teams/roles surface plus moderation decisions | Five neutral curated notices + free text, with a forced review before every export | `NOTICE_OPTIONS` is data; an org table can replace the constant without touching the review flow |
| Cloud-synced company profile | The local profile covers the single-designer case; sync belongs with brand kits | "Save these as my company defaults" (browser-local) prefills every new label | `CompanyProfile` is a plain record — the storage adapter's brand-kit table is the natural home |
| Compliance phrase-list localization | The flag list is English word-boundary matching | English claim/identifier flagging with excerpts, never auto-deletion | `CLAIM_PHRASES`/`IDENTIFIER_TOKENS` are data arrays in `compliance.ts` |

Shipped since the first build (previously in this table): CSV batch +
dynamic fields, production layers + separations export, team collaboration
UI, share links, hybrid vector PDF, TIFF export, the AI design assistant
(key-gated), MFA, the Apple sign-in flag, **logo upload in Easy Creator**
(PNG/JPG, engine-placed), **template favorites**, and the **120-template
library** (the earlier "110+ templates reframed as archetypes" entry is
superseded — the library now genuinely holds 120 validated, structurally
distinct layouts) — see [ROADMAP.md](./ROADMAP.md) for where each landed.

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
- **Batch verification pages against live RLS + storage.** The
  `batch_records` policies, `get_batch_record` RPC, and the public `coa`
  bucket ship in `0004_verification.sql`; CI proves the local-mode gates
  and the pure helpers only. Verify with two users per SETUP §1.2.
- **Firefox/WebKit e2e runs.** The Playwright projects exist behind
  `PW_BROWSERS=all` and CI has a dispatchable `e2e-cross` job, but this
  sandbox ships Chromium only — the first cross-browser run happens in CI,
  not here.
