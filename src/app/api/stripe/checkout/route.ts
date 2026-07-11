import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";

const bodySchema = z.object({
  planId: z.string().min(1),
  interval: z.enum(["monthly", "yearly"]),
});

/**
 * Creates a Stripe Checkout session for a plan upgrade. Requires a signed-in
 * user; plan/price definitions come from the database (never hardcoded).
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const service = getSupabaseService();
  const supabase = await getSupabaseServer();
  if (!stripe || !service || !supabase) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { planId, interval } = parsed.data;

  const { data: plan } = await service
    .from("plans")
    .select("id,name,stripe_price_monthly,stripe_price_yearly,active")
    .eq("id", planId)
    .maybeSingle();
  if (!plan?.active) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const priceId =
    interval === "monthly" ? plan.stripe_price_monthly : plan.stripe_price_yearly;
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe prices for the ${plan.name} plan haven't been configured yet.` },
      { status: 503 },
    );
  }

  // Reuse or create the Stripe customer for this user.
  const { data: existing } = await service
    .from("stripe_customers")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await service
      .from("stripe_customers")
      .insert({ user_id: user.id, customer_id: customerId });
  }

  const origin = request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing?status=success`,
    cancel_url: `${origin}/billing?status=cancelled`,
    subscription_data: { metadata: { userId: user.id, planId } },
    metadata: { userId: user.id, planId },
  });

  return NextResponse.json({ url: session.url });
}
