"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  Loader2,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import { redo, undo } from "@/lib/document/commands";
import { getStorageAdapter } from "@/lib/storage";
import { useCanUndoRedo } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { useProjectSessionStore } from "@/stores/project-session-store";
import type { Unit } from "@/lib/geometry/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

interface EditorTopBarProps {
  onSave: () => void;
  onFit: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExport: () => void;
}

function SaveStatus() {
  const saveState = useProjectSessionStore((s) => s.saveState);
  const capabilities = getStorageAdapter().capabilities;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
    >
      {saveState === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" aria-hidden /> Saving…
        </>
      )}
      {saveState === "saved" && (
        <>
          <Check className="size-3 text-success" aria-hidden />
          {capabilities.mode === "local" ? "Saved in this browser" : "Saved"}
        </>
      )}
      {saveState === "dirty" && "Unsaved changes"}
      {saveState === "error" && (
        <span className="flex items-center gap-1.5 text-destructive">
          <CloudOff className="size-3" aria-hidden /> Save failed — retrying on next edit
        </span>
      )}
    </span>
  );
}

export function EditorTopBar({
  onSave,
  onFit,
  onActualSize,
  onZoomIn,
  onZoomOut,
  onExport,
}: EditorTopBarProps) {
  const { canUndo, canRedo } = useCanUndoRedo();
  const zoom = useEditorUiStore((s) => s.zoom);
  const displayUnit = useEditorUiStore((s) => s.displayUnit);
  const setDisplayUnit = useEditorUiStore((s) => s.setDisplayUnit);
  const showGuides = useEditorUiStore((s) => s.showGuides);
  const setShowGuides = useEditorUiStore((s) => s.setShowGuides);
  const showRulers = useEditorUiStore((s) => s.showRulers);
  const setShowRulers = useEditorUiStore((s) => s.setShowRulers);
  const projectName = useProjectSessionStore((s) => s.projectName);
  const setProjectName = useProjectSessionStore((s) => s.setProjectName);
  const projectId = useProjectSessionStore((s) => s.projectId);

  const commitName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !projectId) return;
    setProjectName(trimmed);
    await getStorageAdapter().updateProjectMeta(projectId, { name: trimmed });
  };

  return (
    <header className="flex h-13 items-center gap-2 border-b border-border bg-panel px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to projects">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back to projects</TooltipContent>
      </Tooltip>

      <Input
        key={projectName}
        defaultValue={projectName}
        aria-label="Project name"
        className="h-8 w-52 border-transparent bg-transparent font-medium shadow-none hover:border-input focus-visible:border-ring"
        maxLength={80}
        onBlur={(e) => void commitName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />

      <SaveStatus />

      <div className="mx-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Undo <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Redo <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={onZoomOut}>
          <Minus className="size-4" aria-hidden />
        </Button>
        <button
          className="w-14 rounded-md px-1 py-1 text-center text-xs tabular-nums text-muted-foreground hover:bg-muted cursor-pointer"
          onClick={onActualSize}
          aria-label="Zoom to actual print size"
          title="Actual print size (approximate on screen)"
        >
          {Math.round((zoom / (96 / 25.4)) * 100)}%
        </button>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={onZoomIn}>
          <Plus className="size-4" aria-hidden />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fit to screen" onClick={onFit}>
              <Maximize className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Fit to screen <Kbd>0</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showGuides}
          onChange={(e) => setShowGuides(e.target.checked)}
          className="size-3.5 accent-(--primary)"
        />
        Guides
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showRulers}
          onChange={(e) => setShowRulers(e.target.checked)}
          className="size-3.5 accent-(--primary)"
        />
        Rulers
      </label>

      <Select value={displayUnit} onValueChange={(v) => setDisplayUnit(v as Unit)}>
        <SelectTrigger className="h-8 w-16 text-xs" aria-label="Display unit">
          {displayUnit}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mm">mm</SelectItem>
          <SelectItem value="cm">cm</SelectItem>
          <SelectItem value="in">in</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={onSave}>
        Save
      </Button>
      <Button size="sm" onClick={onExport}>
        <Download className="size-4" aria-hidden />
        Export
      </Button>
    </header>
  );
}
