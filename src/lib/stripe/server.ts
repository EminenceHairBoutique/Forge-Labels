import "server-only";
import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Lazy Stripe client; null while billing is unconfigured. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripe ??= new Stripe(key);
  return stripe;
}
