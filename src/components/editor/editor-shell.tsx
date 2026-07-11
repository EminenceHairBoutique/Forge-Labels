"use client";

import * as React from "react";
import Link from "next/link";
import { loadDocument } from "@/lib/document/commands";
import { ensureFinishesRegistered } from "@/lib/finishes";
import { loadFontsForDocument } from "@/lib/fonts/registry";
import { getStorageAdapter } from "@/lib/storage";
import { useDoc } from "@/stores/document-store";
import { MAX_ZOOM, MIN_ZOOM, useEditorUiStore } from "@/stores/editor-ui-store";
import { useProjectSessionStore } from "@/stores/project-session-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { ACTUAL_SIZE_ZOOM, EditorCanvas, computeFitViewport } from "./editor-canvas";
import { EditorContextMenu } from "./editor-context-menu";
import { EditorTopBar } from "./editor-top-bar";
import { EditorToolbar } from "./editor-toolbar";
import { ExportDialog } from "./export-dialog";
import { PrintDialog } from "./print-dialog";
import { MockupDialog } from "@/components/mockup/mockup-dialog";
import { PropertiesPanel } from "./sidebar/properties-panel";
import { LayersPanel } from "./sidebar/layers-panel";
import { BrandPanel } from "./sidebar/brand-panel";
import { saveNow, useAutosave } from "./hooks/use-autosave";
import { useEditorShortcuts } from "./hooks/use-editor-shortcuts";

type LoadState = "loading" | "ready" | "not-found" | "error";

export function EditorShell({ projectId }: { projectId: string }) {
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const doc = useDoc();

  // Simulated-finish patterns feed the shared fill resolver.
  React.useEffect(() => {
    ensureFinishesRegistered();
  }, []);

  // Load the project once.
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
  }, [projectId]);

  useAutosave(projectId, loadState === "ready");

  const handleSave = React.useCallback(() => {
    void saveNow(projectId)
      .then(() => toast.success("Project saved"))
      .catch(() => toast.error("Save failed"));
  }, [projectId]);

  const zoomBy = React.useCallback((factor: number) => {
    const ui = useEditorUiStore.getState();
    // Zoom about the canvas center: adjust pan so the center stays put.
    const container = document.querySelector('[data-testid="editor-canvas"]');
    const rect = container?.getBoundingClientRect();
    const cx = (rect?.width ?? 800) / 2;
    const cy = (rect?.height ?? 600) / 2;
    const newZoom = Math.min(Math.max(ui.zoom * factor, MIN_ZOOM), MAX_ZOOM);
    const worldX = (cx - ui.panX) / ui.zoom;
    const worldY = (cy - ui.panY) / ui.zoom;
    ui.setViewport(newZoom, cx - worldX * newZoom, cy - worldY * newZoom);
  }, []);

  const fit = React.useCallback(() => {
    const currentDoc = doc;
    if (!currentDoc) return;
    const container = document.querySelector('[data-testid="editor-canvas"]');
    const rect = container?.getBoundingClientRect();
    if (!rect) return;
    const v = computeFitViewport(currentDoc, rect.width, rect.height);
    useEditorUiStore.getState().setViewport(v.zoom, v.panX, v.panY);
  }, [doc]);

  const actualSize = React.useCallback(() => {
    const ui = useEditorUiStore.getState();
    const container = document.querySelector('[data-testid="editor-canvas"]');
    const rect = container?.getBoundingClientRect();
    const cx = (rect?.width ?? 800) / 2;
    const cy = (rect?.height ?? 600) / 2;
    const worldX = (cx - ui.panX) / ui.zoom;
    const worldY = (cy - ui.panY) / ui.zoom;
    ui.setViewport(ACTUAL_SIZE_ZOOM, cx - worldX * ACTUAL_SIZE_ZOOM, cy - worldY * ACTUAL_SIZE_ZOOM);
  }, []);

  useEditorShortcuts({
    onSave: handleSave,
    onFit: fit,
    onActualSize: actualSize,
    onZoomIn: () => zoomBy(1.25),
    onZoomOut: () => zoomBy(1 / 1.25),
  });

  if (loadState === "not-found") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-xl font-semibold">Project not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This project doesn&apos;t exist in this browser&apos;s storage. In local
          demo mode, projects don&apos;t roam between browsers or devices.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to projects</Link>
        </Button>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-xl font-semibold">Couldn&apos;t open this project</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The stored project data appears to be corrupted.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to projects</Link>
        </Button>
      </div>
    );
  }

  if (loadState === "loading" || !doc) {
    return (
      <div className="flex h-dvh flex-col gap-2 p-3" aria-busy>
        <Skeleton className="h-12" />
        <div className="flex flex-1 gap-2">
          <Skeleton className="w-12" />
          <Skeleton className="flex-1" />
          <Skeleton className="hidden w-72 lg:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <EditorTopBar
        onSave={handleSave}
        onFit={fit}
        onActualSize={actualSize}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(1 / 1.25)}
        onExport={() => setExportOpen(true)}
        onPrint={() => setPrintOpen(true)}
        onPreview={() => setPreviewOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        <EditorToolbar />
        <EditorContextMenu>
          <div className="min-w-0 flex-1">
            <EditorCanvas doc={doc} />
          </div>
        </EditorContextMenu>
        <aside
          className="hidden w-76 shrink-0 flex-col overflow-y-auto border-l border-border bg-panel md:flex"
          aria-label="Inspector"
        >
          <Tabs defaultValue="properties" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 grid grid-cols-3">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="layers">Layers</TabsTrigger>
              <TabsTrigger value="brand">Brand</TabsTrigger>
            </TabsList>
            <TabsContent value="properties" className="mt-0 flex-1">
              <PropertiesPanel doc={doc} />
            </TabsContent>
            <TabsContent value="layers" className="mt-0 flex-1">
              <LayersPanel doc={doc} />
            </TabsContent>
            <TabsContent value="brand" className="mt-0 flex-1">
              <BrandPanel doc={doc} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <p className="border-t border-border bg-panel px-3 py-1 text-[11px] text-muted-foreground md:hidden">
        Advanced editing works best on desktop or tablet.
      </p>
      <ExportDialog doc={doc} open={exportOpen} onOpenChange={setExportOpen} />
      <PrintDialog doc={doc} open={printOpen} onOpenChange={setPrintOpen} />
      <MockupDialog doc={doc} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}
