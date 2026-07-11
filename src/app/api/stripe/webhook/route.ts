import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { getSupabaseService } from "@/lib/supabase/service";

/**
 * Stripe webhook: the ONLY writer of subscription state. Signature-verified
 * against the raw body; idempotent via the stripe_events ledger (Stripe
 * retries deliveries). Configure the endpoint for:
 *   checkout.session.completed, customer.subscription.created,
 *   customer.subscription.updated, customer.subscription.deleted
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const service = getSupabaseService();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !service || !webhookSecret) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Idempotency: first delivery wins; retries acknowledge without reapplying.
  const { data: ledger } = await service
    .from("stripe_events")
    .insert({ id: event.id, type: event.type })
    .select("id")
    .maybeSingle();
  if (!ledger) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  async function planIdForPrice(priceId: string | undefined): Promise<string | null> {
    if (!priceId) return null;
    const { data } = await service!
      .from("plans")
      .select("id")
      .or(`stripe_price_monthly.eq.${priceId},stripe_price_yearly.eq.${priceId}`)
      .maybeSingle();
    return data?.id ?? null;
  }

  async function upsertSubscription(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    if (!userId) return; // Not one of ours (metadata is set at checkout).
    const priceId = subscription.items.data[0]?.price.id;
    const planId =
      (await planIdForPrice(priceId)) ?? subscription.metadata.planId ?? "pro";
    const periodEnd = subscription.items.data[0]?.current_period_end;
    await service!.from("subscriptions").upsert({
      id: subscription.id,
      user_id: userId,
      plan_id: planId,
      status: subscription.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id,
          );
          await upsertSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object);
        break;
      }
      default:
        break; // Acknowledged but not handled.
    }
  } catch (err) {
    // Surface a 500 so Stripe retries; remove the ledger row to allow it.
    await service.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
