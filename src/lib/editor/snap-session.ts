"use client";

import type Konva from "konva";
import type { LabelDocument } from "@/lib/document/schema";
import { collectSnapLines, snapBox, type SnapLines, type SnapResult } from "./snapping";

/**
 * Per-drag session state: snap candidate lines plus the Konva nodes of
 * co-selected objects for multi-drag. One drag happens at a time, so a
 * module-level singleton is sufficient and keeps drag frames allocation-free.
 */

export interface DragSibling {
  id: string;
  node: Konva.Node;
  startX: number;
  startY: number;
}

interface DragSession {
  lines: SnapLines;
  primaryStart: { x: number; y: number };
  siblings: DragSibling[];
}

let session: DragSession | null = null;

export function beginDragSession(
  doc: LabelDocument,
  excludeIds: ReadonlySet<string>,
  primaryStart: { x: number; y: number },
  siblings: DragSibling[],
): void {
  session = {
    lines: collectSnapLines(doc, excludeIds),
    primaryStart,
    siblings,
  };
}

export function dragSession(): DragSession | null {
  return session;
}

export function applySessionSnap(
  box: { x: number; y: number; width: number; height: number },
  thresholdMm: number,
): SnapResult | null {
  if (!session) return null;
  return snapBox(session.lines, box, thresholdMm);
}

export function endDragSession(): void {
  session = null;
}
