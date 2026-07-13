import { getStorageAdapter } from "@/lib/storage";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { PLAN_SEED, type PlanEntitlements } from "./plan-seed";

/**
 * Client-side entitlement resolution. Local demo mode unlocks everything —
 * the banner already promises "every feature available for evaluation".
 * Cloud mode resolves the signed-in user's subscription plan (database
 * row first, seed as fallback); guests get the free tier. This gating is
 * advisory UX: all rendering happens client-side, so the honest goal is a
 * truthful upgrade prompt, not enforcement.
 */

export type EntitlementSource = "demo" | "free" | "subscription";

export interface ResolvedEntitlements {
  planId: string;
  planName: string;
  source: EntitlementSource;
  entitlements: PlanEntitlements;
}

const DEMO: ResolvedEntitlements = {
  planId: "demo",
  planName: "Local demo",
  source: "demo",
  entitlements: {
    ...PLAN_SEED.find((p) => p.id === "business")!.entitlements,
    maxProjects: null,
  },
};

function seedPlan(planId: string): ResolvedEntitlements {
  const plan = PLAN_SEED.find((p) => p.id === planId) ?? PLAN_SEED[0]!;
  return {
    planId: plan.id,
    planName: plan.name,
    source: plan.id === "free" ? "free" : "subscription",
    entitlements: plan.entitlements,
  };
}

/**
 * Pure core (unit-tested): map auth/subscription state to entitlements.
 * `dbEntitlements` is the plan row's JSONB when the database returned one.
 */
export function resolveFromState(state: {
  mode: "local" | "cloud";
  signedIn: boolean;
  planId: string | null;
  dbEntitlements?: Partial<PlanEntitlements> | null;
  dbPlanName?: string | null;
}): ResolvedEntitlements {
  if (state.mode === "local") return DEMO;
  if (!state.signedIn || !state.planId) return seedPlan("free");
  const base = seedPlan(state.planId);
  if (!state.dbEntitlements) return base;
  return {
    planId: state.planId,
    planName: state.dbPlanName ?? base.planName,
    source: base.source,
    entitlements: { ...base.entitlements, ...state.dbEntitlements },
  };
}

/** Resolve for the current session (browser only; safe in local mode). */
export async function resolveEntitlements(): Promise<ResolvedEntitlements> {
  const mode = getStorageAdapter().capabilities.mode;
  if (mode === "local") return DEMO;

  const status = useAuthStore.getState().status;
  const supabase = getSupabaseBrowser();
  if (status !== "signed-in" || !supabase) {
    return resolveFromState({ mode: "cloud", signedIn: false, planId: null });
  }

  try {
    const { data: subRows } = await supabase
      .from("subscriptions")
      .select("plan_id,status")
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1);
    const planId = (subRows?.[0]?.plan_id as string | undefined) ?? "free";

    const { data: planRow } = await supabase
      .from("plans")
      .select("id,name,entitlements")
      .eq("id", planId)
      .maybeSingle();

    return resolveFromState({
      mode: "cloud",
      signedIn: true,
      planId,
      dbEntitlements: (planRow?.entitlements as Partial<PlanEntitlements>) ?? null,
      dbPlanName: (planRow?.name as string | undefined) ?? null,
    });
  } catch {
    return resolveFromState({ mode: "cloud", signedIn: true, planId: "free" });
  }
}
