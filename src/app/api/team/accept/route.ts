import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";
import { evaluateInvitation } from "@/lib/teams-accept";
import { PLAN_SEED } from "@/lib/billing/plan-seed";

/**
 * Invitation acceptance. Invitees cannot read team_invitations under RLS
 * (only org admins can), so the token is validated and the membership row
 * written with the service role — after verifying the signed-in user's email
 * matches the invitation and the owner's plan has a free seat.
 */

const bodySchema = z.object({ token: z.string().min(8) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await getSupabaseServer();
  const service = getSupabaseService();
  if (!supabase || !service) {
    return NextResponse.json(
      { error: "Teams require cloud mode (Supabase is not configured)." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in to accept the invitation." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing invitation token." }, { status: 400 });
  }

  const { data: invite } = await service
    .from("team_invitations")
    .select("id,org_id,email,role,accepted_at,organizations(id,name,owner_id)")
    .eq("token", parsed.data.token)
    .maybeSingle();

  const org = (invite?.organizations ?? null) as
    | { id: string; name: string; owner_id: string }
    | null;

  const [{ count: memberCount }, { data: membership }] = await Promise.all([
    service
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", invite?.org_id ?? "00000000-0000-0000-0000-000000000000"),
    service
      .from("organization_members")
      .select("user_id")
      .eq("org_id", invite?.org_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Seat limit comes from the ORG OWNER's plan (database row, seed fallback).
  let maxTeamMembers = PLAN_SEED[0]!.entitlements.maxTeamMembers;
  let planName = PLAN_SEED[0]!.name;
  if (org) {
    const { data: sub } = await service
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", org.owner_id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const planId = (sub?.plan_id as string | undefined) ?? "free";
    const seedPlan = PLAN_SEED.find((p) => p.id === planId);
    if (seedPlan) {
      maxTeamMembers = seedPlan.entitlements.maxTeamMembers;
      planName = seedPlan.name;
    }
    const { data: planRow } = await service
      .from("plans")
      .select("name,entitlements")
      .eq("id", planId)
      .maybeSingle();
    const dbMax = (planRow?.entitlements as { maxTeamMembers?: number } | null)
      ?.maxTeamMembers;
    if (typeof dbMax === "number") maxTeamMembers = dbMax;
    if (planRow?.name) planName = planRow.name as string;
  }

  const decision = evaluateInvitation({
    invitation: invite
      ? {
          email: invite.email as string,
          acceptedAt: (invite.accepted_at as string | null) ?? null,
          orgExists: Boolean(org),
        }
      : null,
    userEmail: user.email,
    alreadyMember: Boolean(membership),
    memberCount: (memberCount ?? 0) + 1, // + the implicit owner seat
    maxTeamMembers,
    planName,
  });

  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  if (!decision.alreadyMember) {
    const { error: insertError } = await service.from("organization_members").insert({
      org_id: invite!.org_id as string,
      user_id: user.id,
      role: invite!.role as string,
    });
    if (insertError) {
      return NextResponse.json(
        { error: `Couldn't join the team: ${insertError.message}` },
        { status: 500 },
      );
    }
  }
  await service
    .from("team_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite!.id as string);

  return NextResponse.json({
    orgId: org!.id,
    orgName: org!.name,
    alreadyMember: decision.alreadyMember,
  });
}
