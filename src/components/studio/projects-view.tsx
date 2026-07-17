"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  FlaskConical,
  MoreVertical,
  Pencil,
  Search,
  Share2,
  Sparkles,
  TestTube,
  Trash2,
  Users,
} from "lucide-react";
import { ShareDialog } from "./share-dialog";
import { getStorageAdapter } from "@/lib/storage";
import type { ProjectSummary } from "@/lib/storage/types";
import { getVialPreset } from "@/lib/vials/presets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { NewLabelDialog } from "@/components/studio/new-label-dialog";
import { Onboarding } from "@/components/easy/onboarding";

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ProjectsView() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectSummary[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [renameTarget, setRenameTarget] = React.useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<ProjectSummary | null>(null);
  const [shareTarget, setShareTarget] = React.useState<ProjectSummary | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reloadTick, setReloadTick] = React.useState(0);

  const reload = React.useCallback(async () => {
    setReloadTick((t) => t + 1);
  }, []);

  React.useEffect(() => {
    let alive = true;
    getStorageAdapter()
      .listProjects()
      .then((list) => {
        if (alive) setProjects(list);
      })
      .catch(() => {
        if (alive) setProjects([]);
      });
    return () => {
      alive = false;
    };
  }, [reloadTick]);

  const filtered = React.useMemo(() => {
    if (!projects) return null;
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [projects, query]);

  async function handleDuplicate(project: ProjectSummary) {
    try {
      const copy = await getStorageAdapter().duplicateProject(project.id);
      toast.success("Project duplicated");
      await reload();
      router.push(`/editor/${copy.id}`);
    } catch (err) {
      toast.error("Couldn't duplicate", err instanceof Error ? err.message : undefined);
    }
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    try {
      await getStorageAdapter().updateProjectMeta(renameTarget.id, { name });
      setRenameTarget(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await getStorageAdapter().deleteProject(deleteTarget.id);
      toast.success("Project deleted");
      setDeleteTarget(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleTeamToggle(project: ProjectSummary) {
    try {
      const { getMyOrganization, moveProjectToOrg } = await import("@/lib/teams");
      if (project.orgId) {
        await moveProjectToOrg(project.id, null);
        toast.success("Removed from the team", "The project is personal again.");
      } else {
        const org = await getMyOrganization();
        if (!org) {
          toast.info(
            "No team yet",
            "Create one on the Team page first, then share projects with it.",
          );
          return;
        }
        await moveProjectToOrg(project.id, org.id);
        toast.success(`Shared with ${org.name}`, "Team members see it on their dashboard.");
      }
      await reload();
    } catch (err) {
      toast.error("Couldn't update the project", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div className="space-y-6">
      <Onboarding />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Your labels</h1>
          <p className="text-sm text-muted-foreground">
            Most recent first — everything saves automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search labels…"
              className="w-40 pl-8 sm:w-56"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search labels"
            />
          </div>
          <NewLabelDialog
            trigger={
              <Button
                variant="outline"
                title="Advanced setup — exact measurements, blank canvas"
              >
                New label
              </Button>
            }
          />
          <Button variant="outline" asChild>
            <Link
              href="/create?industry=research-peptide"
              title="Compound, amount, lot, batch, and a research-use notice"
            >
              <TestTube className="size-4" aria-hidden />
              Research label
            </Link>
          </Button>
          <Button asChild>
            <Link href="/create">
              <Sparkles className="size-4" aria-hidden />
              Make a new label
            </Link>
          </Button>
        </div>
      </div>

      {filtered === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        projects && projects.length > 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No projects match “{query}”.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-14">
            <div className="mx-auto max-w-2xl space-y-6 text-center">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  What would you like to make?
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  You don&apos;t need design experience — sizing, spacing, and
                  print setup are handled for you.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  href="/create"
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary/50 bg-primary-subtle/30 p-5 transition-colors hover:border-primary"
                >
                  <Sparkles className="size-6 text-primary" aria-hidden />
                  <span className="text-sm font-medium">Make my first label</span>
                  <span className="text-xs text-muted-foreground">
                    Guided, about two minutes
                  </span>
                </Link>
                <Link
                  href="/templates"
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-surface p-5 transition-colors hover:border-primary/40"
                >
                  <FlaskConical className="size-6 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">Start from a template</span>
                  <span className="text-xs text-muted-foreground">
                    Professionally designed starting points
                  </span>
                </Link>
                <Link
                  href="/tools/label-calculator"
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-surface p-5 transition-colors hover:border-primary/40"
                >
                  <Search className="size-6 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">Learn about label sizing</span>
                  <span className="text-xs text-muted-foreground">
                    See what fits your vial
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((project) => {
            const preset = project.vialName ? getVialPreset(project.vialName) : null;
            return (
              <li
                key={project.id}
                className="group relative rounded-xl border border-border bg-surface shadow-xs transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/easy/${project.id}`}
                  className="block p-3"
                  aria-label={`Open ${project.name}`}
                >
                  <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg bg-canvas-backdrop">
                    {project.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL thumbnail
                      <img
                        src={project.thumbnail}
                        alt=""
                        className="max-h-full max-w-full object-contain drop-shadow"
                      />
                    ) : (
                      <FlaskConical className="size-8 text-muted-foreground/50" aria-hidden />
                    )}
                  </div>
                  <div className="mt-3 space-y-0.5 pr-8">
                    <h3 className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">{project.name}</span>
                      {project.orgId && (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-primary-subtle px-1 py-px text-[10px] font-medium text-primary"
                          title="Shared with your team"
                        >
                          <Users className="size-2.5" aria-hidden /> Team
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {project.labelSizeMm.width.toFixed(1)} ×{" "}
                      {project.labelSizeMm.height.toFixed(1)} mm
                      {preset ? ` · ${preset.name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Edited {timeAgo(project.updatedAt)}
                    </p>
                  </div>
                </Link>
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${project.name}`}
                        className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenameTarget(project);
                          setRenameValue(project.name);
                        }}
                      >
                        <Pencil /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void handleDuplicate(project)}>
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setShareTarget(project)}>
                        <Share2 /> Share
                      </DropdownMenuItem>
                      {getStorageAdapter().capabilities.mode === "cloud" && (
                        <DropdownMenuItem onSelect={() => void handleTeamToggle(project)}>
                          <Users />
                          {project.orgId ? "Remove from team" : "Move to team"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        data-variant="destructive"
                        onSelect={() => setDeleteTarget(project)}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Rename dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={80}
            aria-label="Project name"
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirmRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmRename()} loading={busy}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the project and its version history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} loading={busy}>
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareTarget && (
        <ShareDialog
          projectId={shareTarget.id}
          projectName={shareTarget.name}
          open={shareTarget !== null}
          onOpenChange={(open) => {
            if (!open) setShareTarget(null);
          }}
        />
      )}
    </div>
  );
}
