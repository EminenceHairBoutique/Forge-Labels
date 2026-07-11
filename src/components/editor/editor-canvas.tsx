"use client";

import * as React from "react";
import Konva from "konva";
import { Group, Layer, Line, Rect, Stage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { LabelDocument, TextObject } from "@/lib/document/schema";
import { findObject } from "@/lib/document/commands";
import { objectAabb } from "@/lib/render/geometry";
import { MAX_ZOOM, MIN_ZOOM, useEditorUiStore } from "@/stores/editor-ui-store";
import { ObjectNode } from "./canvas/object-node";
import { LabelBase, LabelGuides } from "./canvas/label-overlays";
import { CanvasRulers } from "./canvas/rulers";
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

/** Magenta smart-guide lines shown while a drag snaps to something. */
function SnapGuideLines({ doc, zoom }: { doc: LabelDocument; zoom: number }) {
  const guideX = useEditorUiStore((s) => s.snapGuideX);
  const guideY = useEditorUiStore((s) => s.snapGuideY);
  const b = doc.label.bleedMm + 6;
  return (
    <>
      {guideX !== null && (
        <Line
          points={[guideX, -b, guideX, doc.label.heightMm + b]}
          stroke="#e11d8f"
          strokeWidth={1 / zoom}
          dash={[3 / zoom, 2 / zoom]}
          listening={false}
        />
      )}
      {guideY !== null && (
        <Line
          points={[-b, guideY, doc.label.widthMm + b, guideY]}
          stroke="#e11d8f"
          strokeWidth={1 / zoom}
          dash={[3 / zoom, 2 / zoom]}
          listening={false}
        />
      )}
    </>
  );
}

export function EditorCanvas({ doc }: EditorCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Konva.Stage>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  const zoom = useEditorUiStore((s) => s.zoom);
  const panX = useEditorUiStore((s) => s.panX);
  const panY = useEditorUiStore((s) => s.panY);
  const showGuides = useEditorUiStore((s) => s.showGuides);
  const showRulers = useEditorUiStore((s) => s.showRulers);
  const displayUnit = useEditorUiStore((s) => s.displayUnit);
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

  // Marquee selection (mm coordinates in label space).
  const [marquee, setMarquee] = React.useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const toWorld = React.useCallback(
    (pointer: { x: number; y: number }) => {
      const ui = useEditorUiStore.getState();
      return {
        x: (pointer.x - ui.panX) / ui.zoom,
        y: (pointer.y - ui.panY) / ui.zoom,
      };
    },
    [],
  );

  const onStagePointerDown = React.useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Interactions with empty space (the stage itself).
      if (e.target !== e.target.getStage()) return;
      clearSelection();
      useEditorUiStore.getState().setEditingTextId(null);
      if (useEditorUiStore.getState().spacePanning) return;
      const pointer = e.target.getStage()?.getPointerPosition();
      if (!pointer) return;
      const world = toWorld(pointer);
      setMarquee({ x0: world.x, y0: world.y, x1: world.x, y1: world.y });
    },
    [clearSelection, toWorld],
  );

  const onStagePointerMove = React.useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!marquee) return;
      const pointer = e.target.getStage()?.getPointerPosition();
      if (!pointer) return;
      const world = toWorld(pointer);
      setMarquee((m) => (m ? { ...m, x1: world.x, y1: world.y } : m));
    },
    [marquee, toWorld],
  );

  const onStagePointerUp = React.useCallback(() => {
    if (!marquee) return;
    const rect = {
      x: Math.min(marquee.x0, marquee.x1),
      y: Math.min(marquee.y0, marquee.y1),
      width: Math.abs(marquee.x1 - marquee.x0),
      height: Math.abs(marquee.y1 - marquee.y0),
    };
    setMarquee(null);
    // Tiny drags are just clicks — the mousedown already cleared selection.
    if (rect.width < 0.5 && rect.height < 0.5) return;
    const hits = doc.objects
      .filter((o) => o.visible && !o.locked)
      .filter((o) => {
        const box = objectAabb(o);
        return (
          box.x < rect.x + rect.width &&
          box.x + box.width > rect.x &&
          box.y < rect.y + rect.height &&
          box.y + box.height > rect.y
        );
      })
      .map((o) => o.id);
    if (hits.length > 0) useEditorUiStore.getState().setSelection(hits);
  }, [marquee, doc]);

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
          onMouseMove={onStagePointerMove}
          onMouseUp={onStagePointerUp}
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
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom} listening={false}>
              {showGuides && <LabelGuides doc={doc} zoom={zoom} />}
              <SnapGuideLines doc={doc} zoom={zoom} />
              {marquee && (
                <Rect
                  x={Math.min(marquee.x0, marquee.x1)}
                  y={Math.min(marquee.y0, marquee.y1)}
                  width={Math.abs(marquee.x1 - marquee.x0)}
                  height={Math.abs(marquee.y1 - marquee.y0)}
                  fill="#6d5ce022"
                  stroke="#6d5ce0"
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 3 / zoom]}
                />
              )}
            </Group>
            <SelectionTransformer stageRef={stageRef} />
          </Layer>
        </Stage>
      )}

      {showRulers && size.width > 0 && (
        <CanvasRulers
          zoom={zoom}
          panX={panX}
          panY={panY}
          unit={displayUnit}
          width={size.width}
          height={size.height}
        />
      )}

      {editingObj && (
        <TextEditOverlay obj={editingObj} zoom={zoom} panX={panX} panY={panY} />
      )}
    </div>
  );
}
