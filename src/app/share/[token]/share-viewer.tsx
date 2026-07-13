"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Download } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import { migrateDocument } from "@/lib/document/migrate";
import { formatMm } from "@/lib/geometry/units";
import { getStorageAdapter } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { toast } from "@/components/ui/toaster";

/**
 * Client island for the public share page: validates the untrusted document
 * JSON, renders a preview through the standard offscreen pipeline, offers a
 * PNG download, and (for "edit" links) copies the design into the visitor's
 * own studio — cloud account when signed in, browser storage otherwise.
 */

export function ShareViewer({
  projectName,
  rawDoc,
  mode,
}: {
  projectName: string;
  rawDoc: unknown;
  mode: "view" | "edit";
}) {
  const router = useRouter();
  // Untrusted JSONB → validated document; parse failures render the honest
  // "can't display" state (pure derivation, no effect state).
  const doc = React.useMemo<LabelDocument | null>(() => {
    try {
      return migrateDocument(rawDoc);
    } catch {
      return null;
    }
  }, [rawDoc]);
  const invalid = doc === null;
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"copy" | "png" | null>(null);

  React.useEffect(() => {
    if (!doc) return;
    let alive = true;
    void import("@/lib/export/raster").then(async ({ renderThumbnail }) => {
      const url = await renderThumbnail(doc, 1200);
      if (alive) setPreviewUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [doc]);

  async function downloadPng() {
    if (!doc) return;
    setBusy("png");
    try {
      const { exportRaster } = await import("@/lib/export/raster");
      const raster = await exportRaster(doc, {
        dpi: 300,
        mode: "sticker",
        format: "png",
      });
      const url = URL.createObjectURL(raster.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName || "shared-label"}-300dpi.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function copyToStudio() {
    if (!doc) return;
    setBusy("copy");
    try {
      const project = await getStorageAdapter().createProject({
        name: `${projectName || "Shared label"} (copy)`,
        doc,
      });
      toast.success("Copied to your studio");
      router.push(`/editor/${project.id}`);
    } catch (err) {
      toast.error(
        "Couldn't copy the design",
        err instanceof Error ? err.message : undefined,
      );
      setBusy(null);
    }
  }

  if (invalid) {
    return (
      <Callout variant="warning" title="This design can't be displayed">
        The shared document uses a newer format than this deployment
        understands.
      </Callout>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {projectName || "Shared label"}
          </h1>
          {doc && (
            <p className="text-sm text-muted-foreground">
              {formatMm(doc.label.widthMm, "mm", { suffix: false })} ×{" "}
              {formatMm(doc.label.heightMm, "mm")} · shared{" "}
              {mode === "edit" ? "with copy access" : "read-only"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mode === "edit" ? "accent" : "secondary"}>
            {mode === "edit" ? "copyable" : "view only"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            loading={busy === "png"}
            onClick={() => void downloadPng()}
            disabled={!doc}
          >
            <Download className="size-3.5" aria-hidden />
            PNG
          </Button>
          {mode === "edit" && (
            <Button
              size="sm"
              loading={busy === "copy"}
              onClick={() => void copyToStudio()}
              disabled={!doc}
            >
              <CopyPlus className="size-3.5" aria-hidden />
              Copy to my studio
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Preview of ${projectName || "the shared label"}`}
            className="mx-auto max-h-[420px] w-auto max-w-full rounded-lg border border-border bg-white shadow-sm"
          />
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Rendering preview…
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Shared previews render simulated finishes on screen; printed results
        differ. Colors are RGB approximations of print output.
      </p>
    </div>
  );
}
