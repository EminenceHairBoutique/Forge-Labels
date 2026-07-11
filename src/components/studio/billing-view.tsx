"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { PLAN_SEED, formatPlanPrice, type PlanDef } from "@/lib/billing/plan-seed";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";

interface PlanRow {
  id: string;
  name: string;
  blurb: string;
  price_monthly_cents: number | null;
  price_yearly_cents: number | null;
  highlights: string[];
  highlighted: boolean;
  sort: number;
}

interface SubscriptionRow {
  id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

function seedToRows(): PlanRow[] {
  return PLAN_SEED.map((p: PlanDef, i) => ({
    id: p.id,
    name: p.name,
    blurb: p.blurb,
    price_monthly_cents: p.priceMonthlyCents,
    price_yearly_cents: p.priceYearlyCents,
    highlights: [...p.highlights],
    highlighted: p.highlighted ?? false,
    sort: i,
  }));
}

export function BillingView() {
  const status = useAuthStore((s) => s.status);
  const [plans, setPlans] = React.useState<PlanRow[] | null>(null);
  const [subscription, setSubscription] = React.useState<SubscriptionRow | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [busyPlan, setBusyPlan] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        if (alive) {
          setPlans(seedToRows());
          setLoaded(true);
        }
        return;
      }
      // Plans are DB-driven in cloud mode (admins can edit them).
      const { data: planRows } = await supabase
        .from("plans")
        .select("id,name,blurb,price_monthly_cents,price_yearly_cents,highlights,highlighted,sort")
        .eq("active", true)
        .order("sort");
      const { data: subRows } = await supabase
        .from("subscriptions")
        .select("id,plan_id,status,current_period_end,cancel_at_period_end")
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (alive) {
        setPlans(planRows && planRows.length > 0 ? (planRows as PlanRow[]) : seedToRows());
        setSubscription((subRows?.[0] as SubscriptionRow | undefined) ?? null);
        setLoaded(true);
      }
    })().catch(() => {
      if (alive) {
        setPlans(seedToRows());
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [status]);

  async function checkout(planId: string) {
    setBusyPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval: "monthly" }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "Checkout unavailable.");
      }
      window.location.assign(body.url);
    } catch (err) {
      toast.error("Couldn't start checkout", err instanceof Error ? err.message : undefined);
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    setBusyPlan("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Portal unavailable.");
      window.location.assign(body.url);
    } catch (err) {
      toast.error("Couldn't open the portal", err instanceof Error ? err.message : undefined);
      setBusyPlan(null);
    }
  }

  const currentPlanId = subscription?.plan_id ?? "free";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Plans and entitlements are managed in the database — see{" "}
          <Link href="/pricing" className="text-primary underline-offset-2 hover:underline">
            the full comparison
          </Link>
          .
        </p>
      </div>

      {status === "local" && (
        <Callout variant="info" title="Billing needs cloud setup">
          This deployment runs in local demo mode with every feature available
          for evaluation. Subscriptions activate once Supabase and Stripe are
          configured (<code>docs/SETUP.md</code>).
        </Callout>
      )}

      {status === "signed-out" && (
        <Callout variant="info" title="Sign in to manage billing">
          <Link href="/login" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to view your plan and manage your subscription.
        </Callout>
      )}

      {status === "signed-in" && loaded && (
        <Card>
          <CardHeader>
            <CardTitle>Your plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold capitalize">
                {plans?.find((p) => p.id === currentPlanId)?.name ?? currentPlanId}
                {subscription?.status === "past_due" && (
                  <Badge variant="destructive" className="ml-2">
                    Payment past due
                  </Badge>
                )}
                {subscription?.cancel_at_period_end && (
                  <Badge variant="warning" className="ml-2">
                    Cancels at period end
                  </Badge>
                )}
              </p>
              {subscription?.current_period_end && (
                <p className="text-xs text-muted-foreground">
                  Renews {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            {subscription && (
              <Button
                variant="outline"
                loading={busyPlan === "portal"}
                onClick={() => void openPortal()}
              >
                Manage in Stripe portal
                <ExternalLink className="size-3.5" aria-hidden />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loaded ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans?.map((plan) => (
            <Card key={plan.id} className={plan.highlighted ? "border-primary" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.id === currentPlanId && status === "signed-in" && (
                    <Badge>Current</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{plan.blurb}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-display text-2xl font-bold">
                  {formatPlanPrice(plan.price_monthly_cents)}
                  {plan.price_monthly_cents ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      /month
                    </span>
                  ) : null}
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {plan.highlights.slice(0, 5).map((h) => (
                    <li key={h}>✓ {h}</li>
                  ))}
                </ul>
                {status === "signed-in" &&
                  plan.id !== currentPlanId &&
                  plan.price_monthly_cents !== null &&
                  plan.price_monthly_cents > 0 && (
                    <Button
                      className="w-full"
                      loading={busyPlan === plan.id}
                      onClick={() => void checkout(plan.id)}
                    >
                      Upgrade to {plan.name}
                    </Button>
                  )}
                {plan.price_monthly_cents === null && (
                  <Button asChild variant="outline" className="w-full">
                    <a href="mailto:hello@forgelabels.example">Contact us</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
