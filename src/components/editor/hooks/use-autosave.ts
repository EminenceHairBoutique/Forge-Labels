"use client";

import * as React from "react";
import { renderThumbnail } from "@/lib/export/raster";
import { getStorageAdapter } from "@/lib/storage";
import { useDoc } from "@/stores/document-store";
import { useProjectSessionStore } from "@/stores/project-session-store";

const AUTOSAVE_DEBOUNCE_MS = 1200;
const THUMBNAIL_MIN_INTERVAL_MS = 8000;

/**
 * Debounced autosave: any document change marks the session dirty and
 * persists after a quiet period. Thumbnails are refreshed at most every
 * few seconds (they require an offscreen render).
 */
export function useAutosave(projectId: string, enabled: boolean) {
  const doc = useDoc();
  const lastThumbAtRef = React.useRef(0);
  const initialDocRef = React.useRef<typeof doc>(null);

  React.useEffect(() => {
    if (!enabled || !doc) return;
    // The initial loadDocument sets the doc once; that's not a user edit.
    if (initialDocRef.current === null) {
      initialDocRef.current = doc;
      return;
    }
    if (initialDocRef.current === doc) return;

    const session = useProjectSessionStore.getState();
    session.setSaveState("dirty");

    const timer = setTimeout(async () => {
      const state = useProjectSessionStore.getState();
      state.setSaveState("saving");
      try {
        let thumbnail: string | undefined;
        if (Date.now() - lastThumbAtRef.current > THUMBNAIL_MIN_INTERVAL_MS) {
          try {
            thumbnail = await renderThumbnail(doc, 360);
            lastThumbAtRef.current = Date.now();
          } catch {
            // Thumbnails are cosmetic; never block a save on them.
          }
        }
        await getStorageAdapter().saveProjectDoc(projectId, doc, thumbnail);
        useProjectSessionStore.getState().markSaved();
      } catch {
        useProjectSessionStore.getState().setSaveState("error");
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [doc, enabled, projectId]);
}

/** Immediate save used by Cmd+S and the Save button. */
export async function saveNow(projectId: string): Promise<void> {
  const { useDocumentStore } = await import("@/stores/document-store");
  const doc = useDocumentStore.getState().doc;
  if (!doc) return;
  const session = useProjectSessionStore.getState();
  session.setSaveState("saving");
  try {
    let thumbnail: string | undefined;
    try {
      thumbnail = await renderThumbnail(doc, 360);
    } catch {
      // cosmetic only
    }
    await getStorageAdapter().saveProjectDoc(projectId, doc, thumbnail);
    useProjectSessionStore.getState().markSaved();
  } catch {
    useProjectSessionStore.getState().setSaveState("error");
    throw new Error("Save failed");
  }
}
