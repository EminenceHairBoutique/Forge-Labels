"use client";

import * as React from "react";
import Konva from "konva";
import { Group, Layer, Stage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { LabelDocument, TextObject } from "@/lib/document/schema";
import { findObject } from "@/lib/document/commands";
import { MAX_ZOOM, MIN_ZOOM, useEditorUiStore } from "@/stores/editor-ui-store";
import { ObjectNode } from "./canvas/object-node";
import { LabelBase, LabelGuides } from "./canvas/label-overlays";
import { SelectionTransformer } from "./canvas/selection-transformer";
import { TextEditOverlay } from "./canvas/text-edit-overlay";

interface EditorCanvasProps {
  doc: LabelDocument;
}

/** Screen px per mm at 100% "actual size" on a typical 96-DPI display. */
export const ACTUAL_SIZE_ZOOM = 96 / 25.4;

export function computeFitViewport(
  doc: LabelDocument,
  containerW: number,
  containerH: number,
): { zoom: number; panX: number; panY: number } {
  const pad = 48;
  const b = doc.label.bleedMm;
  const totalW = doc.label.widthMm + 2 * b;
  const totalH = doc.label.heightMm + 2 * b;
  const zoom = Math.min(
    Math.max(
      Math.min((containerW - pad * 2) / totalW, (containerH - pad * 2) / totalH),
      MIN_ZOOM,
    ),
    MAX_ZOOM,
  );
  return {
    zoom,
    panX: (containerW - doc.label.widthMm * zoom) / 2,
    panY: (containerH - doc.label.heightMm * zoom) / 2,
  };
}

export function EditorCanvas({ doc }: EditorCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Konva.Stage>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  const zoom = useEditorUiStore((s) => s.zoom);
  const panX = useEditorUiStore((s) => s.panX);
  const panY = useEditorUiStore((s) => s.panY);
  const showGuides = useEditorUiStore((s) => s.showGuides);
  const spacePanning = useEditorUiStore((s) => s.spacePanning);
  const editingTextId = useEditorUiStore((s) => s.editingTextId);
  const setViewport = useEditorUiStore((s) => s.setViewport);
  const setPan = useEditorUiStore((s) => s.setPan);
  const clearSelection = useEditorUiStore((s) => s.clearSelection);

  const fittedRef = React.useRef(false);

  // Track the container size.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initial fit once the container has a size.
  React.useEffect(() => {
    if (fittedRef.current || size.width === 0 || size.height === 0) return;
    fittedRef.current = true;
    const v = computeFitViewport(doc, size.width, size.height);
    setViewport(v.zoom, v.panX, v.panY);
  }, [size, doc, setViewport]);

  const onWheel = React.useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const ui = useEditorUiStore.getState();
      if (e.evt.ctrlKey || e.evt.metaKey) {
        // Zoom about the cursor.
        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();
        if (!pointer) return;
        const scaleBy = Math.exp(-e.evt.deltaY * 0.0022);
        const newZoom = Math.min(Math.max(ui.zoom * scaleBy, MIN_ZOOM), MAX_ZOOM);
        const worldX = (pointer.x - ui.panX) / ui.zoom;
        const worldY = (pointer.y - ui.panY) / ui.zoom;
        setViewport(newZoom, pointer.x - worldX * newZoom, pointer.y - worldY * newZoom);
      } else {
        setPan(ui.panX - e.evt.deltaX, ui.panY - e.evt.deltaY);
      }
    },
    [setPan, setViewport],
  );

  const onStagePointerDown = React.useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Click on empty space (the stage itself) clears the selection.
      if (e.target === e.target.getStage()) {
        clearSelection();
        useEditorUiStore.getState().setEditingTextId(null);
      }
    },
    [clearSelection],
  );

  const onStageDragEnd = React.useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      if (e.target === stageRef.current) {
        setPan(e.target.x(), e.target.y());
        // The scaled groups read pan from the store; reset stage position so
        // panning isn't applied twice.
        e.target.position({ x: 0, y: 0 });
      }
    },
    [setPan],
  );

  const editingObj =
    editingTextId !== null ? (findObject(doc, editingTextId) as TextObject | null) : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full overflow-hidden bg-canvas-backdrop"
      data-testid="editor-canvas"
      style={{ cursor: spacePanning ? "grab" : undefined }}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onWheel={onWheel}
          onMouseDown={onStagePointerDown}
          onTouchStart={onStagePointerDown}
          draggable={spacePanning}
          onDragEnd={onStageDragEnd}
        >
          {/* Static base: label paper + background (not listening). */}
          <Layer listening={false}>
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
              <LabelBase doc={doc} zoom={zoom} />
            </Group>
          </Layer>

          {/* Content: interactive objects in mm coordinates. */}
          <Layer>
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
              {doc.objects.map((obj) => (
                <ObjectNode key={obj.id} obj={obj} />
              ))}
            </Group>
          </Layer>

          {/* Overlay: guides (scaled group) + transformer (unscaled layer). */}
          <Layer>
            {showGuides && (
              <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom} listening={false}>
                <LabelGuides doc={doc} zoom={zoom} />
              </Group>
            )}
            <SelectionTransformer stageRef={stageRef} />
          </Layer>
        </Stage>
      )}

      {editingObj && (
        <TextEditOverlay obj={editingObj} zoom={zoom} panX={panX} panY={panY} />
      )}
    </div>
  );
}
