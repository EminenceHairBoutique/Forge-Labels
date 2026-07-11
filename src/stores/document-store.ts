"use client";

import { create, useStore } from "zustand";
import { temporal, type TemporalState } from "zundo";
import type { LabelDocument } from "@/lib/document/schema";

/**
 * The document store holds ONLY the label document, wrapped in zundo's
 * temporal middleware. Ephemeral editor state (selection, zoom, tool)
 * lives in editor-ui-store and never pollutes undo history.
 *
 * All mutations must go through lib/document/commands.ts — that module owns
 * gesture batching (one undo entry per drag/slider gesture).
 */

interface DocumentState {
  doc: LabelDocument | null;
}

export const useDocumentStore = create<DocumentState>()(
  temporal((): DocumentState => ({ doc: null }), {
    limit: 100,
    partialize: (state) => ({ doc: state.doc }),
    // Commands always produce a new doc reference; reference equality is
    // enough and keeps history writes cheap.
    equality: (pastState, currentState) => pastState.doc === currentState.doc,
  }),
);

/** Subscribe to undo/redo state from React (temporal is a vanilla store). */
export function useTemporalStore<T>(
  selector: (state: TemporalState<DocumentState>) => T,
): T {
  return useStore(useDocumentStore.temporal, selector);
}

/** Convenience selectors */
export const useDoc = () => useDocumentStore((s) => s.doc);

export function useCanUndoRedo(): { canUndo: boolean; canRedo: boolean } {
  const canUndo = useTemporalStore((s) => s.pastStates.length > 0);
  const canRedo = useTemporalStore((s) => s.futureStates.length > 0);
  return { canUndo, canRedo };
}
