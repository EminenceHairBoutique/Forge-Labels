# Deployment

Forge Labels is a standard Next.js 16 app: no custom server, no background
workers, no filesystem writes at runtime. Exports, rendering, and (in local
mode) persistence all happen in the browser; the only server code is the
route handlers under `src/app/api/` and the session-refresh proxy.

## Vercel (recommended)

1. Push the repository to GitHub and import it in Vercel — the framework
   preset is detected automatically (`npm run build`).
2. Add environment variables (**Project → Settings → Environment
   Variables**). All are optional — see the reference in
   [SETUP.md](SETUP.md#3-environment-variable-reference):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — do **not** expose to the
     client; no `NEXT_PUBLIC_` prefix)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_ENABLED`
3. Deploy. With no variables set the deployment runs in local demo mode and
   is still a complete, honest product — a reasonable way to stage the UI
   before wiring the backend.
4. After the first deploy, finish the cloud wiring against the real domain:
   - Supabase **Authentication → URL Configuration**: set the Site URL to
     the production origin and allow `https://<domain>/auth/callback`.
   - Stripe webhook endpoint: `https://<domain>/api/stripe/webhook`
     (production signing secret → `STRIPE_WEBHOOK_SECRET`).
5. Preview deployments: Supabase OAuth redirects and Stripe webhooks are
   origin-bound, so cloud sign-in and billing generally work only on the
   production domain unless you allow-list each preview URL. Local demo mode
   works on every preview automatically.

Notes:

- `src/proxy.ts` (Next 16's middleware equivalent) refreshes Supabase
  sessions on matched routes and is a no-op without Supabase env vars.
- The Stripe webhook route reads the raw request body for signature
  verification; it must not sit behind anything that re-encodes bodies
  (Vercel is fine as-is).
- Fonts, the mockup HDR environment, and finish patterns are bundled — no
  external CDN calls at runtime, so the app works behind strict CSPs and
  offline-ish networks.

## Any Node host / container

```bash
npm ci
npm run build
npm run start        # serves .next on PORT (default 3000)
```

Requirements: Node 20+ (CI runs 22), ~512 MB RAM for the server process.
Set the same environment variables at the process level. Terminate TLS in
front (the app assumes `https` origins for OAuth callbacks and Stripe).

## Post-deploy checklist

1. `/` renders; `/dashboard` shows the local-demo banner **only if** cloud
   mode is off.
2. Cloud mode: sign up, confirm the verification email arrives, sign in,
   create a project, reload — it loads from Postgres (check the `projects`
   table).
3. `/admin` gated: 404-equivalent callout for non-admins; template seeding
   works for the granted admin ([SETUP.md §1.5–1.6](SETUP.md)).
4. Billing (if enabled): test-mode checkout round-trip per
   [SETUP.md §2.5](SETUP.md#25-smoke-test-test-mode).
5. Export a PNG and a PDF from a real project and measure them
   ([PRINT-ACCURACY.md](PRINT-ACCURACY.md)).

The full go-live review lives in
[PRODUCTION-READINESS.md](PRODUCTION-READINESS.md).
