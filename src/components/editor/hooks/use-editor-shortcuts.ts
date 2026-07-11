"use client";

import * as React from "react";
import {
  duplicateObjects,
  redo,
  removeObjects,
  undo,
  updateObjects,
  withGesture,
  addObject,
} from "@/lib/document/commands";
import type { LabelObject } from "@/lib/document/schema";
import { newObjectId } from "@/lib/document/ids";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";

/** In-memory clipboard (documents are JSON — deep clone via structuredClone). */
let clipboard: LabelObject[] = [];

function cloneWithNewIds(obj: LabelObject): LabelObject {
  const copy = structuredClone(obj);
  const renumber = (o: LabelObject): void => {
    o.id = newObjectId();
    if (o.type === "group") o.children.forEach(renumber);
  };
  renumber(copy);
  return copy;
}

export function copySelection(): void {
  const { doc } = useDocumentStore.getState();
  const { selection } = useEditorUiStore.getState();
  if (!doc || selection.length === 0) return;
  clipboard = doc.objects
    .filter((o) => selection.includes(o.id))
    .map((o) => structuredClone(o));
}

export function pasteClipboard(): void {
  if (clipboard.length === 0) return;
  const clones = clipboard.map((o) => {
    const c = cloneWithNewIds(o);
    c.xMm += 3;
    c.yMm += 3;
    return c;
  });
  withGesture(() => {
    for (const clone of clones) addObject(clone, { select: false });
  });
  useEditorUiStore.getState().setSelection(clones.map((c) => c.id));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export interface ShortcutHandlers {
  onSave: () => void;
  onFit: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function useEditorShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  });

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ui = useEditorUiStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      // While editing text or typing in a field, only intercept Cmd+S.
      if (ui.editingTextId !== null || isTypingTarget(e.target)) {
        if (mod && e.key.toLowerCase() === "s") {
          e.preventDefault();
          handlersRef.current.onSave();
        }
        return;
      }

      switch (true) {
        case mod && e.key.toLowerCase() === "z" && !e.shiftKey:
          e.preventDefault();
          undo();
          return;
        case (mod && e.key.toLowerCase() === "z" && e.shiftKey) ||
          (mod && e.key.toLowerCase() === "y"):
          e.preventDefault();
          redo();
          return;
        case mod && e.key.toLowerCase() === "s":
          e.preventDefault();
          handlersRef.current.onSave();
          return;
        case mod && e.key.toLowerCase() === "d":
          e.preventDefault();
          duplicateObjects(ui.selection);
          return;
        case mod && e.key.toLowerCase() === "c":
          copySelection();
          return;
        case mod && e.key.toLowerCase() === "x":
          copySelection();
          removeObjects(ui.selection);
          return;
        case mod && e.key.toLowerCase() === "v":
          pasteClipboard();
          return;
        case mod && e.key.toLowerCase() === "a": {
          e.preventDefault();
          const doc = useDocumentStore.getState().doc;
          if (doc) {
            ui.setSelection(
              doc.objects.filter((o) => !o.locked && o.visible).map((o) => o.id),
            );
          }
          return;
        }
        case e.key === "Delete" || e.key === "Backspace":
          if (ui.selection.length > 0) {
            e.preventDefault();
            removeObjects(ui.selection);
          }
          return;
        case e.key === "Escape":
          ui.clearSelection();
          return;
        case e.key.startsWith("Arrow"): {
          if (ui.selection.length === 0) return;
          e.preventDefault();
          const step = e.shiftKey ? 2 : e.altKey ? 0.1 : 0.5;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          updateObjects(ui.selection, (o) => ({ xMm: o.xMm + dx, yMm: o.yMm + dy }));
          return;
        }
        case !mod && (e.key === "+" || e.key === "="):
          e.preventDefault();
          handlersRef.current.onZoomIn();
          return;
        case !mod && e.key === "-":
          e.preventDefault();
          handlersRef.current.onZoomOut();
          return;
        case !mod && e.key === "0":
          e.preventDefault();
          handlersRef.current.onFit();
          return;
        case !mod && e.key === "1":
          e.preventDefault();
          handlersRef.current.onActualSize();
          return;
        case e.key === " ": {
          if (!ui.spacePanning) ui.setSpacePanning(true);
          e.preventDefault();
          return;
        }
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " ") useEditorUiStore.getState().setSpacePanning(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
}
