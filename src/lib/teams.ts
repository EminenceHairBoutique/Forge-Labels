import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Team collaboration (cloud mode): one organization per owner, members with
 * roles, invitations as copyable links (no email provider is configured —
 * the UI says so). All reads/writes run under RLS; the owner counts as an
 * implicit top-role member (migration 0003). Invitation acceptance goes
 * through /api/team/accept because invitees cannot read the invitation row
 * under RLS.
 */

export type OrgRole = "owner" | "admin" | "editor" | "viewer";

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface OrgMember {
  userId: string;
  role: OrgRole;
  email: string;
  displayName: string | null;
  joinedAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: Exclude<OrgRole, "owner">;
  token: string;
  createdAt: string;
}

function requireSupabase() {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Teams require cloud mode.");
  return supabase;
}

/** The organization this user owns or belongs to (first one, if several). */
export async function getMyOrganization(): Promise<Organization | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,owner_id,created_at")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load your team: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    ownerId: data.owner_id as string,
    createdAt: data.created_at as string,
  };
}

export async function createOrganization(name: string): Promise<Organization> {
  const supabase = requireSupabase();
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error("Sign in to create a team.");
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, owner_id: userId })
    .select("id,name,owner_id,created_at")
    .single();
  if (error) throw new Error(`Couldn't create the team: ${error.message}`);
  return {
    id: data.id as string,
    name: data.name as string,
    ownerId: data.owner_id as string,
    createdAt: data.created_at as string,
  };
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("get_org_members", {
    target_org: orgId,
  });
  if (error) throw new Error(`Couldn't load members: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    userId: row.user_id as string,
    role: row.role as OrgRole,
    email: row.email as string,
    displayName: (row.display_name as string | null) ?? null,
    joinedAt: row.joined_at as string,
  }));
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: Exclude<OrgRole, "owner">,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) throw new Error(`Couldn't change the role: ${error.message}`);
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) throw new Error(`Couldn't remove the member: ${error.message}`);
}

export async function listInvitations(orgId: string): Promise<TeamInvitation[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("team_invitations")
    .select("id,email,role,token,created_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load invitations: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: row.role as TeamInvitation["role"],
    token: row.token as string,
    createdAt: row.created_at as string,
  }));
}

export async function createInvitation(
  orgId: string,
  email: string,
  role: TeamInvitation["role"],
): Promise<TeamInvitation> {
  const supabase = requireSupabase();
  const userId = useAuthStore.getState().user?.id;
  const { data, error } = await supabase
    .from("team_invitations")
    .insert({ org_id: orgId, email: email.trim().toLowerCase(), role, invited_by: userId })
    .select("id,email,role,token,created_at")
    .single();
  if (error) throw new Error(`Couldn't create the invitation: ${error.message}`);
  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role as TeamInvitation["role"],
    token: data.token as string,
    createdAt: data.created_at as string,
  };
}

export async function revokeInvitation(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("team_invitations").delete().eq("id", id);
  if (error) throw new Error(`Couldn't revoke the invitation: ${error.message}`);
}

export function invitationUrl(token: string): string {
  return `${location.origin}/team/accept?token=${token}`;
}

/** Assign (or unassign with null) a project to the organization. */
export async function moveProjectToOrg(
  projectId: string,
  orgId: string | null,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ org_id: orgId })
    .eq("id", projectId);
  if (error) throw new Error(`Couldn't move the project: ${error.message}`);
}
