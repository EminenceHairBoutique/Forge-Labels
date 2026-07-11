import type { LabelDocument, LabelObject } from "@/lib/document/schema";
import { objectAabb } from "@/lib/render/geometry";

/**
 * Object/canvas snapping. On drag start the editor collects candidate snap
 * lines once (label edges/center/safe zone + other objects' edges/centers);
 * every drag frame binary-searches the nearest line for the moving box's
 * left/center/right (and top/middle/bottom) within a zoom-relative
 * threshold. Pure math — unit-tested.
 */

export interface SnapLines {
  xs: number[];
  ys: number[];
}

export function collectSnapLines(
  doc: LabelDocument,
  excludeIds: ReadonlySet<string>,
): SnapLines {
  const xs: number[] = [];
  const ys: number[] = [];

  const w = doc.label.widthMm;
  const h = doc.label.heightMm;
  const s = doc.label.safeMm;
  xs.push(0, w / 2, w, s, w - s);
  ys.push(0, h / 2, h, s, h - s);

  for (const obj of doc.objects) {
    if (excludeIds.has(obj.id) || !obj.visible) continue;
    const box = objectAabb(obj);
    xs.push(box.x, box.x + box.width / 2, box.x + box.width);
    ys.push(box.y, box.y + box.height / 2, box.y + box.height);
  }

  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  return { xs, ys };
}

/** Nearest value in a sorted array (binary search). */
export function nearest(sorted: number[], value: number): number | null {
  if (sorted.length === 0) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [sorted[lo]!, sorted[Math.max(lo - 1, 0)]!];
  return candidates.reduce((best, c) =>
    Math.abs(c - value) < Math.abs(best - value) ? c : best,
  );
}

export interface SnapResult {
  /** Position delta to apply to the dragged box. */
  dx: number;
  dy: number;
  /** Matched guide line coordinates (for drawing), or null. */
  guideX: number | null;
  guideY: number | null;
}

export function snapBox(
  lines: SnapLines,
  box: { x: number; y: number; width: number; height: number },
  thresholdMm: number,
): SnapResult {
  const xTargets = [box.x, box.x + box.width / 2, box.x + box.width];
  const yTargets = [box.y, box.y + box.height / 2, box.y + box.height];

  let dx = 0;
  let guideX: number | null = null;
  let bestX = thresholdMm;
  for (const t of xTargets) {
    const line = nearest(lines.xs, t);
    if (line === null) continue;
    const dist = Math.abs(line - t);
    if (dist < bestX) {
      bestX = dist;
      dx = line - t;
      guideX = line;
    }
  }

  let dy = 0;
  let guideY: number | null = null;
  let bestY = thresholdMm;
  for (const t of yTargets) {
    const line = nearest(lines.ys, t);
    if (line === null) continue;
    const dist = Math.abs(line - t);
    if (dist < bestY) {
      bestY = dist;
      dy = line - t;
      guideY = line;
    }
  }

  return { dx, dy, guideX, guideY };
}

/** AABB for an object at an overridden center position. */
export function aabbAt(obj: LabelObject, xMm: number, yMm: number) {
  const box = objectAabb(obj);
  return { x: xMm - box.width / 2, y: yMm - box.height / 2, width: box.width, height: box.height };
}
