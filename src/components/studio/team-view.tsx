"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Link2, Trash2, Users } from "lucide-react";
import {
  createInvitation,
  createOrganization,
  getMyOrganization,
  invitationUrl,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type OrgMember,
  type Organization,
  type TeamInvitation,
} from "@/lib/teams";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";

/**
 * Team workspace: one organization per account, role-based members, and
 * invitation links (no email provider is configured — links are copied and
 * shared manually, and the UI says so). Cloud mode only.
 */

const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"] as const;

export function TeamView() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);

  const [org, setOrg] = React.useState<Organization | null | undefined>(undefined);
  const [members, setMembers] = React.useState<OrgMember[]>([]);
  const [invites, setInvites] = React.useState<TeamInvitation[]>([]);
  const [maxSeats, setMaxSeats] = React.useState<number>(1);
  const [planName, setPlanName] = React.useState<string>("Free");
  const [orgName, setOrgName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<(typeof ASSIGNABLE_ROLES)[number]>("editor");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (status !== "signed-in") return;
    let alive = true;
    (async () => {
      const found = await getMyOrganization();
      if (!alive) return;
      setOrg(found);
      if (found) {
        const [memberRows, inviteRows, resolved] = await Promise.all([
          listMembers(found.id),
          listInvitations(found.id).catch(() => []),
          resolveEntitlements(),
        ]);
        if (!alive) return;
        setMembers(memberRows);
        setInvites(inviteRows);
        setMaxSeats(resolved.entitlements.maxTeamMembers);
        setPlanName(resolved.planName);
      }
    })().catch((err: unknown) => {
      if (alive) {
        setOrg(null);
        toast.error("Couldn't load the team", err instanceof Error ? err.message : undefined);
      }
    });
    return () => {
      alive = false;
    };
  }, [status, tick]);

  if (status === "local") {
    return (
      <Gate>
        <Callout variant="info" title="Teams require cloud mode">
          Team workspaces store members and roles in Postgres and activate
          once Supabase is configured — see <code>docs/SETUP.md</code>. Local
          demo mode stays single-user.
        </Callout>
      </Gate>
    );
  }
  if (status === "loading") {
    return (
      <Gate>
        <Skeleton className="h-40" />
      </Gate>
    );
  }
  if (status === "signed-out") {
    return (
      <Gate>
        <Callout variant="info" title="Sign in to manage your team">
          <Link href="/login" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to create a team workspace and invite collaborators.
        </Callout>
      </Gate>
    );
  }

  async function handleCreateOrg() {
    const name = orgName.trim();
    if (!name) return;
    setBusy("create-org");
    try {
      await createOrganization(name);
      setTick((t) => t + 1);
      toast.success("Team created");
    } catch (err) {
      toast.error("Couldn't create the team", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function handleInvite() {
    if (!org) return;
    const email = inviteEmail.trim();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy("invite");
    try {
      const invite = await createInvitation(org.id, email, inviteRole);
      setInvites((prev) => [invite, ...prev]);
      setInviteEmail("");
      await copyInvite(invite);
    } catch (err) {
      toast.error("Couldn't create the invitation", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function copyInvite(invite: TeamInvitation) {
    try {
      await navigator.clipboard.writeText(invitationUrl(invite.token));
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((c) => (c === invite.id ? null : c)), 2000);
      toast.success("Invitation link copied", `Send it to ${invite.email} yourself — no email is sent automatically.`);
    } catch {
      toast.info("Copy this link", invitationUrl(invite.token));
    }
  }

  const seatsUsed = members.length;
  const seatsLeft = Math.max(0, maxSeats - seatsUsed);
  const canManage =
    org !== null &&
    org !== undefined &&
    (org.ownerId === userId ||
      members.some((m) => m.userId === userId && (m.role === "owner" || m.role === "admin")));

  return (
    <Gate>
      {org === undefined ? (
        <Skeleton className="h-40" />
      ) : org === null ? (
        <Card>
          <CardHeader>
            <CardTitle>Create your team workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A team shares projects: assign a project to the team from its
              card menu and every member can open it, with edit rights by role.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="org-name">Team name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  placeholder="e.g. Aurelis Labs"
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <Button loading={busy === "create-org"} onClick={() => void handleCreateOrg()}>
                <Users className="size-4" aria-hidden />
                Create team
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{org.name}</CardTitle>
                <Badge variant="secondary">
                  {seatsUsed}/{maxSeats} seats · {planName}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {members.map((member) => (
                  <li key={member.userId} className="flex items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{member.email}</p>
                      {member.displayName && (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.displayName}
                        </p>
                      )}
                    </div>
                    {member.role === "owner" ? (
                      <Badge>owner</Badge>
                    ) : canManage ? (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(role) => {
                            void updateMemberRole(
                              org.id,
                              member.userId,
                              role as (typeof ASSIGNABLE_ROLES)[number],
                            )
                              .then(() => setTick((t) => t + 1))
                              .catch((err: unknown) =>
                                toast.error(
                                  "Couldn't change the role",
                                  err instanceof Error ? err.message : undefined,
                                ),
                              );
                          }}
                        >
                          <SelectTrigger
                            className="h-7 w-24 text-xs"
                            aria-label={`Role for ${member.email}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${member.email}`}
                          onClick={() => {
                            void removeMember(org.id, member.userId)
                              .then(() => setTick((t) => t + 1))
                              .catch((err: unknown) =>
                                toast.error(
                                  "Couldn't remove the member",
                                  err instanceof Error ? err.message : undefined,
                                ),
                              );
                          }}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="secondary">{member.role}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Invite a collaborator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Invitations are <strong>links you send yourself</strong> (this
                  deployment sends no email). The invitee signs in with the
                  invited address and accepts.
                </p>
                {seatsLeft === 0 ? (
                  <Callout variant="info" title="All seats are in use">
                    The {planName} plan includes {maxSeats} seat
                    {maxSeats === 1 ? "" : "s"}.{" "}
                    <Link href="/billing" className="text-primary underline-offset-2 hover:underline">
                      Upgrade
                    </Link>{" "}
                    to add more collaborators.
                  </Callout>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        placeholder="teammate@example.com"
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-role">Role</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v) =>
                          setInviteRole(v as (typeof ASSIGNABLE_ROLES)[number])
                        }
                      >
                        <SelectTrigger id="invite-role" className="h-9 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button loading={busy === "invite"} onClick={() => void handleInvite()}>
                      <Link2 className="size-4" aria-hidden />
                      Create link
                    </Button>
                  </div>
                )}

                {invites.length > 0 && (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {invites.map((invite) => (
                      <li key={invite.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">{invite.email}</span>
                        <Badge variant="secondary">{invite.role}</Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Copy invitation for ${invite.email}`}
                          onClick={() => void copyInvite(invite)}
                        >
                          {copiedId === invite.id ? (
                            <Check className="size-3.5 text-success" aria-hidden />
                          ) : (
                            <Copy className="size-3.5" aria-hidden />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Revoke invitation for ${invite.email}`}
                          onClick={() => {
                            void revokeInvitation(invite.id)
                              .then(() =>
                                setInvites((prev) => prev.filter((i) => i.id !== invite.id)),
                              )
                              .catch((err: unknown) =>
                                toast.error(
                                  "Couldn't revoke",
                                  err instanceof Error ? err.message : undefined,
                                ),
                              );
                          }}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Callout variant="info">
            Share a project with the team from its card menu on the{" "}
            <Link href="/dashboard" className="text-primary underline-offset-2 hover:underline">
              Projects
            </Link>{" "}
            page (“Move to team”). Members open team projects from their own
            dashboard; editors and admins can change them.
          </Callout>
        </div>
      )}
    </Gate>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Shared projects, roles, and invitations.
        </p>
      </div>
      {children}
    </div>
  );
}
