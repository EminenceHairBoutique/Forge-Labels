# Setup — Supabase (accounts & cloud sync), Stripe (billing), AI assistant

Forge Labels runs three ways, each fully functional for what it claims:

| Mode           | Env vars set                     | What works                                                                 |
| -------------- | -------------------------------- | -------------------------------------------------------------------------- |
| **Local demo** | none                             | Full editor, exports, templates, mockups; projects persist in the browser  |
| **Cloud**      | Supabase pair (+ service role)   | Everything above **plus** accounts, cloud projects/assets, admin dashboard |
| **Cloud + billing** | Supabase + Stripe trio      | Everything above **plus** subscriptions via Stripe Checkout                |

The app never fakes a mode it isn't in: without Supabase, auth pages explain
local demo mode instead of rendering dead forms; without Stripe, the billing
page shows plans but no checkout buttons.

Copy `.env.example` to `.env.local` and fill in values as you complete each
section below.

---

## 1. Supabase

### 1.1 Create the project

1. Create a project at [supabase.com](https://supabase.com) (any region/plan).
2. In **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

The anon key is safe to expose — every table has Row Level Security. The
service-role key bypasses RLS: server-only, never commit it, never prefix it
with `NEXT_PUBLIC_`. The code guards this (`src/lib/supabase/service.ts`
imports `server-only`), but treat the value with the same care.

### 1.2 Run the migrations

Four files in `supabase/migrations/`, in order:

- `0001_init.sql` — all tables, RLS policies, helper functions
  (`is_admin()`, `is_org_member()`), the `get_shared_project` RPC, and the
  storage buckets (`user-assets`, `user-fonts` private; `template-assets`
  public) with folder-scoped policies.
- `0002_seed.sql` — the four plans (pricing lives in the database, not in
  code) and template categories.
- `0003_team_ui.sql` — owner-inclusive membership checks and the
  `get_org_members` directory function used by the Team page.
- `0004_verification.sql` — hosted batch-verification records
  (`batch_records` + the anon-executable `get_batch_record` RPC) and the
  public `coa` bucket (PDF-only, owner-namespaced writes) behind the
  `/verify/[token]` pages. Verify with two test users: owners see only
  their rows; anonymous reads work solely through the RPC and only for
  `published` records.

Either paste each file into the **SQL Editor** and run them, or use the
Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/ in order
```

### 1.3 Configure auth providers

In **Authentication → Providers**:

- **Email** is on by default — covers password sign-in and magic links.
  Under **Authentication → URL Configuration**, set the Site URL to your
  deployment origin (e.g. `https://labels.example.com`) and add
  `https://labels.example.com/auth/callback` to the redirect allow-list
  (plus `http://localhost:3000/auth/callback` for development).
- **Google** (optional): create an OAuth client in Google Cloud Console with
  authorized redirect URI
  `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the
  client ID/secret into the Google provider settings. The app's Google
  buttons appear automatically — no code change.
- **Apple** (optional, flag-gated): configure the Apple provider in Supabase
  (needs an Apple Developer account: Services ID, key, team ID — Supabase's
  Apple guide walks through it), then set `NEXT_PUBLIC_AUTH_APPLE=1`. The
  "Sign in with Apple" button renders only behind the flag, because an
  unconfigured provider would be a dead button.

### 1.4 Two-factor authentication (TOTP)

MFA needs no configuration beyond Supabase itself (TOTP is enabled by
default on GoTrue). To verify the flow end to end:

1. Sign in, open **Settings → Security**, click **Set up two-factor
   authentication**.
2. Scan the QR with any authenticator app (or paste the secret), enter the
   6-digit code, and confirm the factor shows as enrolled.
3. Sign out and back in with email/password — the login form now stops at a
   code prompt (`aal2` challenge) before entering the studio.
4. Remove the factor from Settings → Security and confirm sign-in no longer
   asks for a code.

Local demo mode shows an honest "requires cloud mode" note instead of the
controls.

### 1.5 Start the app in cloud mode

```bash
npm run dev
```

With the two `NEXT_PUBLIC_SUPABASE_*` vars set, sign-up/sign-in pages render
real forms, sessions refresh via `src/proxy.ts`, and signed-in users read and
write their own rows under RLS. Signed-out visitors still get the full
editor with browser persistence, plus a sign-in prompt. On first sign-in the
app offers a one-time import of any local projects into the cloud account.

### 1.6 Grant the first admin

Roles live in `user_roles`, which **only the service role can write** — a
user cannot promote themselves. After the account has signed in once, run in
the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ((select id from auth.users where email = 'you@example.com'), 'admin')
on conflict (user_id) do update set role = 'admin';
```

`/admin` now unlocks for that account.

### 1.8 Verify teams and share links (two test users)

CI covers local-mode gating only — these flows need a live project:

1. **Teams.** As user A: **Team** page → create an organization → **Invite
   member** (role: editor) → copy the invite link. Open it in a second
   browser as user B (matching the invited email): B lands on the accept
   page, joins, and appears in A's member list. Move a project to the team
   from its card menu; B sees it on their dashboard with a "Team" badge.
   Re-using the link must fail with "already used"; a third seat past the
   plan limit must be refused with the plan named.
2. **Share links.** From a project card (or the editor's Share button):
   create a view link, open it signed-out — the read-only page renders the
   design with a download option and no edit controls. Revoke the link and
   confirm the page turns into the honest "link no longer available" state.
   A "copy" mode link must offer "Open a copy in the studio" to signed-in
   viewers.

### 1.7 Seed the template library

Templates are served from the database in cloud mode so admins can curate
them. In **/admin → Templates**, click **“Seed from code registry”** — it
upserts the 16 built-in templates (by slug) as published rows. Publish or
unpublish individual templates from the same screen.

---

## 2. Stripe

Prerequisite: Supabase configured (subscriptions are stored in Postgres and
written only by the webhook using the service role).

### 2.1 Keys

From the Stripe Dashboard (**Developers → API keys**), set
`STRIPE_SECRET_KEY` (test mode first: `sk_test_…`).

### 2.2 Products and prices

Pricing is data, not code: the checkout route looks up the price ID on the
plan row. For each paid plan (`pro`, `business`):

1. Create a Product with a **recurring** monthly Price (and optionally a
   yearly one).
2. Copy the `price_…` IDs onto the plan row:

```sql
update public.plans
set stripe_price_monthly = 'price_XXXXXXXXXXXX',
    stripe_price_yearly  = 'price_YYYYYYYYYYYY'
where id = 'pro';
```

Keep the displayed amounts (`price_monthly_cents`/`price_yearly_cents`) in
sync with the Stripe prices — the UI renders from the database.

### 2.3 Webhook

The webhook is the **only** writer of subscription state (idempotent via the
`stripe_events` ledger; signature-verified).

1. **Developers → Webhooks → Add endpoint**:
   `https://<your-domain>/api/stripe/webhook`
2. Subscribe to: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
3. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

For local development:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# prints a whsec_… — use it as STRIPE_WEBHOOK_SECRET while developing
```

### 2.4 Enable the UI

Set `NEXT_PUBLIC_STRIPE_ENABLED=1`. Billing now shows checkout buttons for
paid plans and, for subscribers, the Stripe customer-portal link (enable the
portal once in **Settings → Billing → Customer portal** in Stripe).

### 2.5 Smoke test (test mode)

1. Sign in, open **/billing**, click **Upgrade to Pro**.
2. Pay with card `4242 4242 4242 4242`, any future expiry/CVC.
3. You land back on `/billing?status=success`; within a couple of seconds
   the webhook writes the subscription and the page shows the plan as
   current. Verify a row exists in `subscriptions` and in `stripe_events`.
4. Cancel from the portal; the `customer.subscription.updated`/`deleted`
   events flip `cancel_at_period_end`/`status` accordingly.

---

## 3. AI design assistant

The editor's **AI** tab activates when the server has a Claude API key.
Without one, the tab (and `POST /api/assistant`, with a 503) explains
exactly what's missing — nothing else in the app depends on it.

### 3.1 Enable

1. Create an API key at [console.anthropic.com](https://console.anthropic.com).
2. Set `ANTHROPIC_API_KEY` in the deployment (server-only — the browser only
   ever learns a `configured: true/false` boolean from
   `/api/assistant/status`).
3. Optional tuning: `ASSISTANT_MODEL` overrides the model id;
   `ASSISTANT_EFFORT` (`low`/`medium`/`high`/`max`, default `low`) trades
   latency for reasoning depth.

### 3.2 How it's guarded

The route proxies exactly one model round per request. It owns the system
prompt and tool definitions (clients cannot inject either), enforces
same-origin, requires a signed-in user in cloud mode (local demo mode has no
accounts — key possession is the boundary there), rate-limits to 20
requests/minute per user/IP, and caps request bodies at 256 KB. Documents
never leave the browser raw: the assistant sees a capped text summary, and
its edits run client-side through the same undoable command bus as manual
edits (one undo entry per assistant turn).

### 3.3 Smoke test (live key)

1. Set the key, restart, open any project, switch to the **AI** tab.
2. Ask for something concrete: *"Add the name 'Retinol Serum' as a bold
   title near the top."* Tool chips appear, the canvas updates, and the
   reply describes the change.
3. Press **Cmd/Ctrl+Z** once — the entire assistant turn reverts as one
   undo step.
4. Ask for something out of bounds (*"upload a photo"*): the assistant
   explains where in the UI to do it instead of faking a change.

---

## 4. Environment variable reference

| Variable                        | Scope   | Purpose                                        |
| ------------------------------- | ------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client  | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client  | Public anon key (RLS enforces access)          |
| `SUPABASE_SERVICE_ROLE_KEY`     | server  | Webhook/billing/invite writes; bypasses RLS    |
| `STRIPE_SECRET_KEY`             | server  | Stripe API                                     |
| `STRIPE_WEBHOOK_SECRET`         | server  | Webhook signature verification                 |
| `NEXT_PUBLIC_STRIPE_ENABLED`    | client  | `1` shows checkout/portal UI                   |
| `NEXT_PUBLIC_AUTH_APPLE`        | client  | `1` shows the Apple sign-in button             |
| `ANTHROPIC_API_KEY`             | server  | Activates the editor's AI assistant            |
| `ASSISTANT_MODEL`               | server  | Optional assistant model override              |
| `ASSISTANT_EFFORT`              | server  | Optional reasoning effort (default `low`)      |

All optional; each absent group degrades honestly (see the table at the top).

Next: [DEPLOYMENT.md](DEPLOYMENT.md) ·
[PRODUCTION-READINESS.md](PRODUCTION-READINESS.md)
