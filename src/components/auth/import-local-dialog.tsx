"use client";

import * as React from "react";
import { getStorageAdapter } from "@/lib/storage";
import { LocalAdapter } from "@/lib/storage/local";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";

const OFFERED_KEY = "fl-local-import-offered";

/**
 * One-shot offer after the first sign-in on a browser that has local
 * projects: copy them into the cloud account. Local copies are kept.
 */
export function ImportLocalDialog() {
  const status = useAuthStore((s) => s.status);
  const [localCount, setLocalCount] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (status !== "signed-in") return;
    try {
      if (localStorage.getItem(OFFERED_KEY)) return;
    } catch {
      return;
    }
    let alive = true;
    new LocalAdapter()
      .listProjects()
      .then((projects) => {
        if (!alive || projects.length === 0) return;
        setLocalCount(projects.length);
        setOpen(true);
      })
      .catch(() => {
        // No local storage access — nothing to offer.
      });
    return () => {
      alive = false;
    };
  }, [status]);

  function dismiss() {
    try {
      localStorage.setItem(OFFERED_KEY, "1");
    } catch {
      // Best-effort; worst case the offer reappears next session.
    }
    setOpen(false);
  }

  async function importAll() {
    setBusy(true);
    try {
      const local = new LocalAdapter();
      const cloud = getStorageAdapter();
      const projects = await local.listProjects();
      let copied = 0;
      for (const summary of projects) {
        const project = await local.getProject(summary.id);
        if (!project) continue;
        await cloud.createProject({
          name: project.name,
          doc: project.doc,
          tags: project.tags,
        });
        copied++;
      }
      toast.success(`Imported ${copied} project${copied === 1 ? "" : "s"} to your account`);
      dismiss();
    } catch (err) {
      toast.error("Import failed", err instanceof Error ? err.message : undefined);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bring your local projects along?</DialogTitle>
          <DialogDescription>
            This browser has {localCount} project{localCount === 1 ? "" : "s"} saved
            locally. Copy {localCount === 1 ? "it" : "them"} into your account so
            they sync across devices? Local copies stay untouched.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Not now
          </Button>
          <Button loading={busy} onClick={() => void importAll()}>
            Import to my account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
