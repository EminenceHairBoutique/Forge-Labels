"use client";

import { create } from "zustand";
import type { Unit } from "@/lib/geometry/units";

export type EditorTool =
  | "select"
  | "text"
  | "rect"
  | "ellipse"
  | "line"
  | "polygon"
  | "star"
  | "image"
  | "qrcode"
  | "barcode";

interface EditorUiState {
  selection: string[];
  tool: EditorTool;
  zoom: number;
  panX: number;
  panY: number;
  editingTextId: string | null;
  displayUnit: Unit;
  snapEnabled: boolean;
  showGuides: boolean; // bleed/safe/center overlays
  showRulers: boolean;
  showGrid: boolean;
  sidebarTab: "properties" | "layers";
  spacePanning: boolean;
  /** Active smart-guide lines while dragging (mm), null when idle. */
  snapGuideX: number | null;
  snapGuideY: number | null;

  setSelection: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  setTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setViewport: (zoom: number, panX: number, panY: number) => void;
  setEditingTextId: (id: string | null) => void;
  setDisplayUnit: (unit: Unit) => void;
  setSnapEnabled: (v: boolean) => void;
  setShowGuides: (v: boolean) => void;
  setShowRulers: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setSidebarTab: (tab: "properties" | "layers") => void;
  setSpacePanning: (v: boolean) => void;
  setSnapGuides: (x: number | null, y: number | null) => void;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 24;

export const useEditorUiStore = create<EditorUiState>()((set) => ({
  selection: [],
  tool: "select",
  zoom: 4,
  panX: 0,
  panY: 0,
  editingTextId: null,
  displayUnit: "mm",
  snapEnabled: true,
  showGuides: true,
  showRulers: true,
  showGrid: false,
  sidebarTab: "properties",
  spacePanning: false,
  snapGuideX: null,
  snapGuideY: null,

  setSelection: (ids) => set({ selection: ids }),
  toggleSelected: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
    })),
  clearSelection: () => set({ selection: [] }),
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) =>
    set({ zoom: Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM) }),
  setPan: (panX, panY) => set({ panX, panY }),
  setViewport: (zoom, panX, panY) =>
    set({ zoom: Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM), panX, panY }),
  setEditingTextId: (editingTextId) => set({ editingTextId }),
  setDisplayUnit: (displayUnit) => set({ displayUnit }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setShowRulers: (showRulers) => set({ showRulers }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setSpacePanning: (spacePanning) => set({ spacePanning }),
  setSnapGuides: (snapGuideX, snapGuideY) =>
    set((s) =>
      s.snapGuideX === snapGuideX && s.snapGuideY === snapGuideY
        ? s
        : { snapGuideX, snapGuideY },
    ),
}));
