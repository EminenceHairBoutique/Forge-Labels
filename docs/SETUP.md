# Setup — Supabase (accounts & cloud sync) and Stripe (billing)

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

Two files in `supabase/migrations/`, in order:

- `0001_init.sql` — all tables, RLS policies, helper functions
  (`is_admin()`, `is_org_member()`), the `get_shared_project` RPC, and the
  storage buckets (`user-assets`, `user-fonts` private; `template-assets`
  public) with folder-scoped policies.
- `0002_seed.sql` — the four plans (pricing lives in the database, not in
  code) and template categories.

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

### 1.4 Start the app in cloud mode

```bash
npm run dev
```

With the two `NEXT_PUBLIC_SUPABASE_*` vars set, sign-up/sign-in pages render
real forms, sessions refresh via `src/proxy.ts`, and signed-in users read and
write their own rows under RLS. Signed-out visitors still get the full
editor with browser persistence, plus a sign-in prompt. On first sign-in the
app offers a one-time import of any local projects into the cloud account.

### 1.5 Grant the first admin

Roles live in `user_roles`, which **only the service role can write** — a
user cannot promote themselves. After the account has signed in once, run in
the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ((select id from auth.users where email = 'you@example.com'), 'admin')
on conflict (user_id) do update set role = 'admin';
```

`/admin` now unlocks for that account.

### 1.6 Seed the template library

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

## 3. Environment variable reference

| Variable                        | Scope   | Purpose                                        |
| ------------------------------- | ------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client  | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client  | Public anon key (RLS enforces access)          |
| `SUPABASE_SERVICE_ROLE_KEY`     | server  | Webhook/billing writes; bypasses RLS           |
| `STRIPE_SECRET_KEY`             | server  | Stripe API                                     |
| `STRIPE_WEBHOOK_SECRET`         | server  | Webhook signature verification                 |
| `NEXT_PUBLIC_STRIPE_ENABLED`    | client  | `1` shows checkout/portal UI                   |

All optional; each absent group degrades honestly (see the table at the top).

Next: [DEPLOYMENT.md](DEPLOYMENT.md) ·
[PRODUCTION-READINESS.md](PRODUCTION-READINESS.md)
