"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
  shareUrl,
  type ShareLink,
  type ShareMode,
} from "@/lib/sharing";
import { getStorageAdapter } from "@/lib/storage";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

/**
 * Share-link management for one project. Cloud mode only — local mode gets
 * an honest explainer (links need a server to resolve tokens).
 */

interface ShareDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const sharingAvailable = getStorageAdapter().capabilities.sharing;
  const status = useAuthStore((s) => s.status);
  const [links, setLinks] = React.useState<ShareLink[] | null>(null);
  const [mode, setMode] = React.useState<ShareMode>("view");
  const [expiry, setExpiry] = React.useState<string>("never");
  const [busy, setBusy] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !sharingAvailable) return;
    let alive = true;
    listShareLinks(projectId)
      .then((rows) => {
        if (alive) setLinks(rows);
      })
      .catch((err: unknown) => {
        if (alive) {
          setLinks([]);
          toast.error(
            "Couldn't load share links",
            err instanceof Error ? err.message : undefined,
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [open, sharingAvailable, projectId]);

  async function create() {
    setBusy(true);
    try {
      const link = await createShareLink(projectId, {
        mode,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      });
      setLinks((prev) => [link, ...(prev ?? [])]);
      await copy(link);
    } catch (err) {
      toast.error(
        "Couldn't create the link",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(shareUrl(link.token));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 2000);
    } catch {
      toast.info("Copy this link", shareUrl(link.token));
    }
  }

  async function revoke(link: ShareLink) {
    try {
      await revokeShareLink(link.id);
      setLinks((prev) => (prev ?? []).filter((l) => l.id !== link.id));
      toast.success("Link revoked");
    } catch (err) {
      toast.error(
        "Couldn't revoke the link",
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{projectName}”</DialogTitle>
          <DialogDescription>
            Anyone with a link sees a read-only preview; “copy” links also let
            them duplicate the design into their own studio.
          </DialogDescription>
        </DialogHeader>

        {!sharingAvailable ? (
          <Callout variant="info" title="Sharing needs cloud mode">
            Share links resolve on the server, so they activate once Supabase
            is configured and you’re signed in (<code>docs/SETUP.md</code>).
            In local demo mode, use Settings → “Download backup” to hand a
            design to someone.
          </Callout>
        ) : status !== "signed-in" ? (
          <Callout variant="info" title="Sign in to share">
            <Link href="/login" className="text-primary underline-offset-2 hover:underline">
              Sign in
            </Link>{" "}
            to create share links for your cloud projects.
          </Callout>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="share-mode">Link type</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as ShareMode)}>
                  <SelectTrigger id="share-mode" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="edit">View + copy to studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="share-expiry">Expires</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger id="share-expiry" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="7">In 7 days</SelectItem>
                    <SelectItem value="30">In 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" loading={busy} onClick={() => void create()}>
                <Link2 className="size-3.5" aria-hidden />
                Create link
              </Button>
            </div>

            {links === null ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Loading links…
              </p>
            ) : links.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                No active links yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {links.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Badge variant={link.mode === "edit" ? "accent" : "secondary"}>
                      {link.mode === "edit" ? "copyable" : "view"}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                      /share/{link.token.slice(0, 12)}…
                    </span>
                    {link.expiresAt && (
                      <span className="shrink-0 text-muted-foreground">
                        until {new Date(link.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copy link"
                      onClick={() => void copy(link)}
                    >
                      {copiedId === link.id ? (
                        <Check className="size-3.5 text-success" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Revoke link"
                      onClick={() => void revoke(link)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
