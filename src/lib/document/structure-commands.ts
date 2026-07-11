"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { objectAabb } from "@/lib/render/geometry";
import { newObjectId } from "./ids";
import type { GroupObject, LabelObject } from "./schema";
import { mutateDocument, updateObjects, withGesture } from "./commands";

/**
 * Structural commands: grouping and alignment. Groups keep children in
 * group-local coordinates (origin = group top-left, children positioned by
 * center like everything else); ungrouping maps children back through the
 * group's transform so nothing moves on screen.
 */

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function groupObjects(ids: readonly string[]): string | null {
  const { doc } = useDocumentStore.getState();
  if (!doc || ids.length < 2) return null;
  const idSet = new Set(ids);
  const selected = doc.objects.filter((o) => idSet.has(o.id));
  if (selected.length < 2) return null;

  // Union AABB of the selection.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const obj of selected) {
    const box = objectAabb(obj);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  const width = maxX - minX;
  const height = maxY - minY;

  const group: GroupObject = {
    id: newObjectId(),
    type: "group",
    name: "Group",
    xMm: minX + width / 2,
    yMm: minY + height / 2,
    widthMm: width,
    heightMm: height,
    rotationDeg: 0,
    opacity: 1,
    locked: false,
    visible: true,
    printLayer: "artwork",
    children: selected.map((o) => ({
      ...o,
      // Children coordinates are relative to the group's top-left corner.
      xMm: o.xMm - minX,
      yMm: o.yMm - minY,
    })),
  };

  // Insert at the position of the topmost selected object.
  const insertIndex =
    doc.objects.reduce((top, o, i) => (idSet.has(o.id) ? i : top), 0) -
    (selected.length - 1);

  mutateDocument((current) => {
    const rest = current.objects.filter((o) => !idSet.has(o.id));
    const objects = [...rest];
    objects.splice(Math.max(0, Math.min(insertIndex, rest.length)), 0, group);
    return { ...current, objects };
  });
  useEditorUiStore.getState().setSelection([group.id]);
  return group.id;
}

/** Map a group child back into document space (accounting for rotation). */
function childToDocSpace(group: GroupObject, child: LabelObject): LabelObject {
  const rad = degToRad(group.rotationDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Child center relative to the group's center, in group-local space.
  const relX = child.xMm - group.widthMm / 2;
  const relY = child.yMm - group.heightMm / 2;
  // Rotate by the group's rotation, then translate to the group's center.
  const x = group.xMm + relX * cos - relY * sin;
  const y = group.yMm + relX * sin + relY * cos;
  return {
    ...child,
    xMm: x,
    yMm: y,
    rotationDeg: child.rotationDeg + group.rotationDeg,
    opacity: child.opacity * group.opacity,
  };
}

export function ungroupObjects(ids: readonly string[]): void {
  const { doc } = useDocumentStore.getState();
  if (!doc) return;
  const idSet = new Set(ids);
  const groups = doc.objects.filter(
    (o): o is GroupObject => o.type === "group" && idSet.has(o.id),
  );
  if (groups.length === 0) return;

  const releasedIds: string[] = [];
  mutateDocument((current) => {
    const objects: LabelObject[] = [];
    for (const obj of current.objects) {
      if (obj.type === "group" && idSet.has(obj.id)) {
        for (const child of obj.children) {
          const released = childToDocSpace(obj, child);
          releasedIds.push(released.id);
          objects.push(released);
        }
      } else {
        objects.push(obj);
      }
    }
    return { ...current, objects };
  });
  useEditorUiStore.getState().setSelection(releasedIds);
}

// ---------------------------------------------------------------------------
// Align & distribute
// ---------------------------------------------------------------------------

export type AlignEdge =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "middle-v"
  | "bottom";

/**
 * Align objects. A single object aligns to the label; multiple objects align
 * to the selection's bounding box.
 */
export function alignObjects(ids: readonly string[], edge: AlignEdge): void {
  const { doc } = useDocumentStore.getState();
  if (!doc || ids.length === 0) return;
  const idSet = new Set(ids);
  const selected = doc.objects.filter((o) => idSet.has(o.id) && !o.locked);
  if (selected.length === 0) return;

  let frame: { x: number; y: number; width: number; height: number };
  if (selected.length === 1) {
    frame = { x: 0, y: 0, width: doc.label.widthMm, height: doc.label.heightMm };
  } else {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const obj of selected) {
      const box = objectAabb(obj);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }
    frame = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  withGesture(() => {
    updateObjects(
      selected.map((o) => o.id),
      (o) => {
        const box = objectAabb(o);
        switch (edge) {
          case "left":
            return { xMm: frame.x + box.width / 2 };
          case "center-h":
            return { xMm: frame.x + frame.width / 2 };
          case "right":
            return { xMm: frame.x + frame.width - box.width / 2 };
          case "top":
            return { yMm: frame.y + box.height / 2 };
          case "middle-v":
            return { yMm: frame.y + frame.height / 2 };
          case "bottom":
            return { yMm: frame.y + frame.height - box.height / 2 };
        }
      },
    );
  });
}

/** Evenly distribute ≥3 objects between the outermost two, per axis. */
export function distributeObjects(
  ids: readonly string[],
  axis: "horizontal" | "vertical",
): void {
  const { doc } = useDocumentStore.getState();
  if (!doc) return;
  const idSet = new Set(ids);
  const selected = doc.objects.filter((o) => idSet.has(o.id) && !o.locked);
  if (selected.length < 3) return;

  const sorted = [...selected].sort((a, b) =>
    axis === "horizontal" ? a.xMm - b.xMm : a.yMm - b.yMm,
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const start = axis === "horizontal" ? first.xMm : first.yMm;
  const end = axis === "horizontal" ? last.xMm : last.yMm;
  const step = (end - start) / (sorted.length - 1);

  withGesture(() => {
    sorted.forEach((obj, index) => {
      const value = start + step * index;
      updateObjects([obj.id], () =>
        axis === "horizontal" ? { xMm: value } : { yMm: value },
      );
    });
  });
}
