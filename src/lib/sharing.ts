import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Share links (cloud mode only): tokened, revocable, optionally expiring
 * links to a read-only project view. Rows live in `shared_links` under
 * owner-scoped RLS; anonymous visitors never touch the table — the public
 * page resolves tokens through the `get_shared_project` security-definer
 * RPC, which checks revocation and expiry itself.
 */

export type ShareMode = "view" | "edit";

export interface ShareLink {
  id: string;
  projectId: string;
  token: string;
  mode: ShareMode;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

interface ShareLinkRow {
  id: string;
  project_id: string;
  token: string;
  mode: ShareMode;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

function toShareLink(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    projectId: row.project_id,
    token: row.token,
    mode: row.mode,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    createdAt: row.created_at,
  };
}

export function shareUrl(token: string): string {
  return `${location.origin}/share/${token}`;
}

export async function listShareLinks(projectId: string): Promise<ShareLink[]> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Sharing requires cloud mode.");
  const { data, error } = await supabase
    .from("shared_links")
    .select("id,project_id,token,mode,expires_at,revoked,created_at")
    .eq("project_id", projectId)
    .eq("revoked", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load share links: ${error.message}`);
  return (data as ShareLinkRow[]).map(toShareLink);
}

export async function createShareLink(
  projectId: string,
  options: { mode: ShareMode; expiresInDays?: number | null },
): Promise<ShareLink> {
  const supabase = getSupabaseBrowser();
  const userId = useAuthStore.getState().user?.id;
  if (!supabase || !userId) throw new Error("Sign in to create share links.");

  const expiresAt =
    options.expiresInDays && options.expiresInDays > 0
      ? new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString()
      : null;

  const { data, error } = await supabase
    .from("shared_links")
    .insert({
      project_id: projectId,
      owner_id: userId,
      mode: options.mode,
      expires_at: expiresAt,
    })
    .select("id,project_id,token,mode,expires_at,revoked,created_at")
    .single();
  if (error) throw new Error(`Couldn't create the share link: ${error.message}`);
  return toShareLink(data as ShareLinkRow);
}

export async function revokeShareLink(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Sharing requires cloud mode.");
  const { error } = await supabase
    .from("shared_links")
    .update({ revoked: true })
    .eq("id", id);
  if (error) throw new Error(`Couldn't revoke the link: ${error.message}`);
}
