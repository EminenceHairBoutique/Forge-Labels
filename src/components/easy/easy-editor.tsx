"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, SlidersHorizontal, Undo2 } from "lucide-react";
import { loadDocument, undo } from "@/lib/document/commands";
import { ensureFinishesRegistered } from "@/lib/finishes";
import { loadFontsForDocument } from "@/lib/fonts/registry";
import { getEasyPalette } from "@/lib/easy/palettes";
import { getMaterial, getMaterialOption } from "@/lib/easy/materials";
import { applyEasyChange } from "@/lib/easy/fields";
import { getStorageAdapter } from "@/lib/storage";
import { useCanUndoRedo, useDoc } from "@/stores/document-store";
import { useProjectSessionStore } from "@/stores/project-session-store";
import { saveNow, useAutosave } from "@/components/editor/hooks/use-autosave";
import { ExportDialog } from "@/components/editor/export-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ContentForm } from "./content-form";
import { MaterialPicker } from "./material-picker";
import { VialStage } from "./vial-stage";
import { cn } from "@/lib/utils";

/**
 * The Easy editor: the vial preview is the canvas, the form is the tool.
 * Same document, same commands, same autosave as the Advanced Editor —
 * "Customize in Advanced Editor" is one click and loses nothing, and
 * documents without Easy metadata redirect there automatically.
 */

type LoadState = "loading" | "ready" | "not-found" | "error";

export function EasyEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [exportOpen, setExportOpen] = React.useState(false);
  const doc = useDoc();
  const projectName = useProjectSessionStore((s) => s.projectName);
  const { canUndo } = useCanUndoRedo();

  React.useEffect(() => {
    ensureFinishesRegistered();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const project = await getStorageAdapter().getProject(projectId);
        if (cancelled) return;
        if (!project) {
          setLoadState("not-found");
          return;
        }
        if (!project.doc.easy) {
          // Advanced-only project — this surface can't edit it meaningfully.
          router.replace(`/editor/${projectId}`);
          return;
        }
        await loadFontsForDocument(project.doc);
        if (cancelled) return;
        useProjectSessionStore.getState().startSession(project.id, project.name);
        loadDocument(project.doc);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
      useProjectSessionStore.getState().endSession();
    };
  }, [projectId, router]);

  useAutosave(projectId, loadState === "ready");

  const handleSave = React.useCallback(() => {
    void saveNow(projectId)
      .then(() => toast.success("Saved"))
      .catch(() => toast.error("Save failed"));
  }, [projectId]);

  if (loadState === "not-found") {
    return (
      <CenteredMessage
        title="Label not found"
        body="This label doesn't exist in this browser's storage."
      />
    );
  }
  if (loadState === "error") {
    return (
      <CenteredMessage
        title="Couldn't open this label"
        body="The stored data appears to be corrupted."
      />
    );
  }
  if (loadState === "loading" || !doc || !doc.easy) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-4" aria-busy>
        <Skeleton className="h-12" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-105" />
          <Skeleton className="h-105" />
        </div>
      </div>
    );
  }

  const material = getMaterial(doc.easy.materialId);
  const option = material
    ? getMaterialOption(material, doc.easy.materialOptionId)
    : undefined;
  const palettes = material?.paletteIds.map(getEasyPalette) ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to your labels">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <button
            type="button"
            onClick={handleSave}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium sm:flex-none"
            title="Save now"
          >
            {projectName || "My label"}
          </button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Saves automatically
          </span>
          <span className="flex-1 sm:hidden" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => undo()}
          >
            <Undo2 className="size-4" aria-hidden />
          </Button>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href={`/editor/${projectId}`}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Advanced Editor
            </Link>
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Download className="size-4" aria-hidden />
            Download / print
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-5 p-4 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        {/* Preview: sticky on desktop, docked on top for phones. */}
        <VialStage
          doc={doc}
          className={cn(
            "top-[4.5rem] h-72 sm:h-96 lg:sticky lg:h-[calc(100dvh-6.5rem)]",
          )}
        />

        <div className="space-y-5 pb-24 lg:pb-8">
          {palettes.length > 0 && (
            <section aria-label="Colors" className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Colors
              </p>
              <ul className="flex flex-wrap gap-2">
                {palettes.map((palette) => (
                  <li key={palette.id}>
                    <button
                      type="button"
                      title={palette.name}
                      aria-label={`Use the ${palette.name} colors`}
                      aria-pressed={doc.easy!.paletteId === palette.id}
                      onClick={() =>
                        void applyEasyChange({ paletteId: palette.id })
                      }
                      className={cn(
                        "flex h-9 w-14 overflow-hidden rounded-lg border-2 transition-colors",
                        doc.easy!.paletteId === palette.id
                          ? "border-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <span
                        className="h-full w-1/2"
                        style={{ backgroundColor: palette.bg ?? "#e5e7eb" }}
                      />
                      <span className="flex h-full w-1/2 flex-col">
                        <span
                          className="h-1/2"
                          style={{ backgroundColor: palette.text }}
                        />
                        <span
                          className="h-1/2"
                          style={{ backgroundColor: palette.accent }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <MaterialSection
            materialName={material?.name}
            optionName={option?.name}
            selection={{
              materialId: doc.easy.materialId,
              optionId: doc.easy.materialOptionId,
              intensity: doc.easy.intensity ?? material?.defaultIntensity ?? "balanced",
            }}
          />

          <section aria-label="Label information" className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Label information
            </p>
            <ContentForm doc={doc} />
          </section>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Need pixel-level control — move things by hand, add shapes and
            images?{" "}
            <Link
              href={`/editor/${projectId}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Customize in the Advanced Editor
            </Link>{" "}
            — it edits this same label, and you can come back anytime.
          </p>
        </div>
      </main>

      <ExportDialog doc={doc} open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}

function MaterialSection({
  materialName,
  optionName,
  selection,
}: {
  materialName?: string;
  optionName?: string;
  selection: { materialId: string; optionId: string; intensity: "subtle" | "balanced" | "bold" | "maximum" };
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <section aria-label="Material" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Material
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-primary"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Done" : "Change material"}
        </Button>
      </div>
      {!open ? (
        <p className="text-sm text-muted-foreground">
          {materialName ?? "Material"}
          {optionName ? ` — ${optionName}` : ""}
        </p>
      ) : (
        <MaterialPicker
          compact
          value={selection}
          onChange={(next) => {
            void applyEasyChange({
              material: { materialId: next.materialId, optionId: next.optionId },
              intensity: next.intensity,
            });
          }}
        />
      )}
    </section>
  );
}

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      <Button asChild>
        <Link href="/dashboard">Back to your labels</Link>
      </Button>
    </div>
  );
}
