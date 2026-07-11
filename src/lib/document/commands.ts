"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { newObjectId } from "./ids";
import type {
  Background,
  LabelDocument,
  LabelGeometry,
  LabelObject,
  VialSpec,
} from "./schema";

/**
 * Every document mutation flows through this module. That gives us:
 * - exactly one undo entry per user gesture (see beginGesture/endGesture),
 * - structural sharing (unchanged objects keep their references),
 * - a single integration point for the future AI assistant (it emits these
 *   same commands, so its changes are undoable like any other edit).
 *
 * Gesture batching (per zundo's semantics — a tracked `set` pushes the
 * PREVIOUS state onto the past stack): the FIRST mutation of a gesture runs
 * tracked, which records the pre-gesture snapshot; then tracking pauses.
 * endGesture resumes tracking WITHOUT a trailing set, so the whole gesture
 * costs one history entry and intermediate states never hit the stack.
 */

let gestureDepth = 0;
let gestureTouched = false;

export function beginGesture(): void {
  gestureDepth += 1;
  if (gestureDepth === 1) gestureTouched = false;
}

export function endGesture(): void {
  if (gestureDepth === 0) return;
  gestureDepth -= 1;
  if (gestureDepth === 0 && gestureTouched) {
    useDocumentStore.temporal.getState().resume();
  }
}

/** Run a function with gesture batching (single undo entry). */
export function withGesture<T>(fn: () => T): T {
  beginGesture();
  try {
    return fn();
  } finally {
    endGesture();
  }
}

/**
 * Run a document mutation with gesture-aware history tracking. All command
 * modules must route through this — never call setState on the document
 * store directly, or gesture batching breaks.
 */
export function mutateDocument(recipe: (doc: LabelDocument) => LabelDocument): void {
  mutate(recipe);
}

function mutate(recipe: (doc: LabelDocument) => LabelDocument): void {
  const { doc } = useDocumentStore.getState();
  if (!doc) return;
  const next = recipe(doc);
  if (next === doc) return;

  if (gestureDepth > 0) {
    if (!gestureTouched) {
      gestureTouched = true;
      useDocumentStore.setState({ doc: next }); // tracked: records pre-gesture state
      useDocumentStore.temporal.getState().pause();
      return;
    }
    useDocumentStore.setState({ doc: next }); // paused: no history write
    return;
  }
  useDocumentStore.setState({ doc: next });
}

// ---------------------------------------------------------------------------
// Document lifecycle
// ---------------------------------------------------------------------------

/** Load a document (project open / version restore). Clears undo history. */
export function loadDocument(doc: LabelDocument): void {
  useDocumentStore.setState({ doc });
  useDocumentStore.temporal.getState().clear();
  useEditorUiStore.getState().clearSelection();
}

export function undo(): void {
  useDocumentStore.temporal.getState().undo();
  pruneSelection();
}

export function redo(): void {
  useDocumentStore.temporal.getState().redo();
  pruneSelection();
}

/** Drop selection entries that no longer exist (after undo/redo/delete). */
function pruneSelection(): void {
  const { doc } = useDocumentStore.getState();
  const ui = useEditorUiStore.getState();
  if (!doc) {
    ui.clearSelection();
    return;
  }
  const ids = new Set<string>();
  walk(doc.objects, (o) => {
    ids.add(o.id);
  });
  const kept = ui.selection.filter((id) => ids.has(id));
  if (kept.length !== ui.selection.length) ui.setSelection(kept);
}

// ---------------------------------------------------------------------------
// Tree helpers (groups contain children; most commands target any depth)
// ---------------------------------------------------------------------------

function walk(objects: LabelObject[], visit: (o: LabelObject) => void): void {
  for (const o of objects) {
    visit(o);
    if (o.type === "group") walk(o.children, visit);
  }
}

export function findObject(doc: LabelDocument, id: string): LabelObject | null {
  let found: LabelObject | null = null;
  walk(doc.objects, (o) => {
    if (o.id === id) found = o;
  });
  return found;
}

function mapTree(
  objects: LabelObject[],
  fn: (o: LabelObject) => LabelObject,
): LabelObject[] {
  let changed = false;
  const next = objects.map((o) => {
    let node = o;
    if (node.type === "group") {
      const children = mapTree(node.children, fn);
      if (children !== node.children) node = { ...node, children };
    }
    const mapped = fn(node);
    if (mapped !== o) changed = true;
    return mapped;
  });
  return changed ? next : objects;
}

function filterTree(
  objects: LabelObject[],
  keep: (o: LabelObject) => boolean,
): LabelObject[] {
  let changed = false;
  const next: LabelObject[] = [];
  for (const o of objects) {
    if (!keep(o)) {
      changed = true;
      continue;
    }
    if (o.type === "group") {
      const children = filterTree(o.children, keep);
      if (children !== o.children) {
        changed = true;
        next.push({ ...o, children });
        continue;
      }
    }
    next.push(o);
  }
  return changed ? next : objects;
}

// ---------------------------------------------------------------------------
// Object commands
// ---------------------------------------------------------------------------

export function addObject(obj: LabelObject, options?: { select?: boolean }): string {
  mutate((doc) => ({ ...doc, objects: [...doc.objects, obj] }));
  if (options?.select !== false) {
    useEditorUiStore.getState().setSelection([obj.id]);
  }
  return obj.id;
}

/** Shallow-merge a patch into one object (any depth). */
export function updateObject<T extends LabelObject>(
  id: string,
  patch: Partial<T>,
): void {
  mutate((doc) => {
    const objects = mapTree(doc.objects, (o) =>
      o.id === id ? ({ ...o, ...patch } as LabelObject) : o,
    );
    return objects === doc.objects ? doc : { ...doc, objects };
  });
}

export function updateObjects(
  ids: readonly string[],
  patch: (o: LabelObject) => Partial<LabelObject>,
): void {
  const idSet = new Set(ids);
  mutate((doc) => {
    const objects = mapTree(doc.objects, (o) =>
      idSet.has(o.id) ? ({ ...o, ...patch(o) } as LabelObject) : o,
    );
    return objects === doc.objects ? doc : { ...doc, objects };
  });
}

export function removeObjects(ids: readonly string[]): void {
  const idSet = new Set(ids);
  mutate((doc) => {
    const objects = filterTree(doc.objects, (o) => !idSet.has(o.id));
    return objects === doc.objects ? doc : { ...doc, objects };
  });
  pruneSelection();
}

function cloneWithNewIds(obj: LabelObject): LabelObject {
  const copy: LabelObject = { ...obj, id: newObjectId() };
  if (copy.type === "group") {
    copy.children = copy.children.map(cloneWithNewIds);
  }
  return copy;
}

/** Duplicate top-level objects with a small offset; returns the new ids. */
export function duplicateObjects(ids: readonly string[]): string[] {
  const { doc } = useDocumentStore.getState();
  if (!doc) return [];
  const idSet = new Set(ids);
  const clones = doc.objects
    .filter((o) => idSet.has(o.id))
    .map((o) => {
      const clone = cloneWithNewIds(o);
      clone.xMm += 2;
      clone.yMm += 2;
      clone.name = o.name ? `${o.name} copy` : o.name;
      return clone;
    });
  if (clones.length === 0) return [];
  mutate((d) => ({ ...d, objects: [...d.objects, ...clones] }));
  const newIds = clones.map((c) => c.id);
  useEditorUiStore.getState().setSelection(newIds);
  return newIds;
}

// --- Z-order (top-level only; groups reorder internally as a unit) ---------

type ZDirection = "front" | "forward" | "backward" | "back";

export function reorderObjects(ids: readonly string[], direction: ZDirection): void {
  const idSet = new Set(ids);
  mutate((doc) => {
    const objs = [...doc.objects];
    const selected = objs.filter((o) => idSet.has(o.id));
    if (selected.length === 0) return doc;
    const rest = objs.filter((o) => !idSet.has(o.id));

    switch (direction) {
      case "front":
        return { ...doc, objects: [...rest, ...selected] };
      case "back":
        return { ...doc, objects: [...selected, ...rest] };
      case "forward": {
        // Move each selected object one slot toward the end.
        for (let i = objs.length - 2; i >= 0; i--) {
          const current = objs[i]!;
          const nextObj = objs[i + 1]!;
          if (idSet.has(current.id) && !idSet.has(nextObj.id)) {
            objs[i] = nextObj;
            objs[i + 1] = current;
          }
        }
        return { ...doc, objects: objs };
      }
      case "backward": {
        for (let i = 1; i < objs.length; i++) {
          const current = objs[i]!;
          const prevObj = objs[i - 1]!;
          if (idSet.has(current.id) && !idSet.has(prevObj.id)) {
            objs[i] = prevObj;
            objs[i - 1] = current;
          }
        }
        return { ...doc, objects: objs };
      }
    }
  });
}

/** Reorder a top-level object to an explicit index (layers panel drag). */
export function moveObjectToIndex(id: string, index: number): void {
  mutate((doc) => {
    const from = doc.objects.findIndex((o) => o.id === id);
    if (from < 0) return doc;
    const objects = [...doc.objects];
    const [obj] = objects.splice(from, 1);
    objects.splice(Math.max(0, Math.min(index, objects.length)), 0, obj!);
    return { ...doc, objects };
  });
}

// ---------------------------------------------------------------------------
// Document-level commands
// ---------------------------------------------------------------------------

export function setBackground(background: Background): void {
  mutate((doc) => ({ ...doc, background }));
}

export function setSubstrate(substrateId: string): void {
  mutate((doc) => ({ ...doc, substrateId }));
}

export function updateLabelGeometry(patch: Partial<LabelGeometry>): void {
  mutate((doc) => ({ ...doc, label: { ...doc.label, ...patch } }));
}

export function updateVial(patch: Partial<VialSpec>): void {
  mutate((doc) => ({ ...doc, vial: { ...doc.vial, ...patch } }));
}
