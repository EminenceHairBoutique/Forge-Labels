"use client";

import * as React from "react";
import { CloudOff, Download, HardDrive, Trash2, Upload } from "lucide-react";
import { getStorageAdapter } from "@/lib/storage";
import { migrateDocument } from "@/lib/document/migrate";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityCard } from "@/components/studio/security-card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { toast } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BackupFile {
  format: "forge-labels-backup";
  version: 1;
  exportedAt: string;
  projects: { name: string; tags: string[]; doc: unknown }[];
}

export function SettingsView() {
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const importRef = React.useRef<HTMLInputElement>(null);
  const capabilities = getStorageAdapter().capabilities;

  async function exportBackup() {
    setBusy(true);
    try {
      const adapter = getStorageAdapter();
      const summaries = await adapter.listProjects();
      const projects: BackupFile["projects"] = [];
      for (const summary of summaries) {
        const project = await adapter.getProject(summary.id);
        if (project) {
          projects.push({ name: project.name, tags: project.tags, doc: project.doc });
        }
      }
      const backup: BackupFile = {
        format: "forge-labels-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        projects,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `forge-labels-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast.success(`Backed up ${projects.length} project${projects.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error("Backup failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      if (parsed.format !== "forge-labels-backup" || !Array.isArray(parsed.projects)) {
        throw new Error("Not a Forge Labels backup file.");
      }
      const adapter = getStorageAdapter();
      let imported = 0;
      for (const entry of parsed.projects) {
        try {
          const doc = migrateDocument(entry.doc);
          await adapter.createProject({
            name: entry.name || "Imported label",
            doc,
            tags: entry.tags ?? [],
          });
          imported++;
        } catch {
          // Skip corrupted entries but import the rest.
        }
      }
      toast.success(
        `Imported ${imported} of ${parsed.projects.length} project${parsed.projects.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      toast.error("Import failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function clearAllData() {
    setBusy(true);
    try {
      const adapter = getStorageAdapter();
      const projects = await adapter.listProjects();
      for (const project of projects) {
        await adapter.deleteProject(project.id);
      }
      for (const asset of await adapter.listAssets()) {
        await adapter.deleteAsset(asset.id);
      }
      for (const kit of await adapter.listBrandKits()) {
        await adapter.deleteBrandKit(kit.id);
      }
      setConfirmClear(false);
      toast.success("Local data cleared");
    } catch (err) {
      toast.error("Couldn't clear data", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Appearance and data for this workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Theme preference is saved in this browser.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm">Light / dark theme</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>
            {capabilities.mode === "local"
              ? "Local demo mode — everything lives in this browser's storage."
              : "Cloud mode — projects sync to your account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {capabilities.mode === "local" && (
            <Callout variant="info" title="Accounts & cloud sync">
              <span className="inline-flex items-center gap-1">
                <CloudOff className="size-3.5" aria-hidden /> Not configured.
              </span>{" "}
              Connecting a Supabase project enables sign-in, cross-device sync,
              and team features — see <code>docs/SETUP.md</code> in the
              repository for the step-by-step guide.
            </Callout>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => void importBackup(e)}
            />
            <Button variant="outline" loading={busy} onClick={() => void exportBackup()}>
              <Download className="size-4" aria-hidden />
              Download backup (JSON)
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => importRef.current?.click()}>
              <Upload className="size-4" aria-hidden />
              Import backup
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Clear local data
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Backups contain projects (with their designs) but not uploaded
            image files — keep original image sources safe separately.
          </p>
        </CardContent>
      </Card>

      <SecurityCard />

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear all local data?</DialogTitle>
            <DialogDescription>
              Permanently deletes every project, asset, and brand kit stored in
              this browser. Download a backup first if in doubt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={busy} onClick={() => void clearAllData()}>
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
