import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";

/** Opens the Stripe billing portal for the signed-in user. */
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
  if (!user) {
    return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
  }

  const { data: customer } = await service
    .from("stripe_customers")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json(
      { error: "No billing history for this account yet." },
      { status: 404 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.customer_id,
    return_url: `${request.nextUrl.origin}/billing`,
  });
  return NextResponse.json({ url: session.url });
}
