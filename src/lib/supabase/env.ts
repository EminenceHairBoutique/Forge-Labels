/**
 * Cloud-mode detection. The app is fully functional without any of these —
 * it runs in local demo mode. Setting the two public vars activates
 * Supabase auth + storage; Stripe additionally needs its secret pair.
 */

export function supabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

export function supabaseAnonKey(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
