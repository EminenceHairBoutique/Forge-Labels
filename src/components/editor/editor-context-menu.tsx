"use client";

import * as React from "react";
import {
  duplicateObjects,
  removeObjects,
  reorderObjects,
  updateObjects,
} from "@/lib/document/commands";
import { groupObjects, ungroupObjects } from "@/lib/document/structure-commands";
import { useDoc } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copySelection, pasteClipboard } from "./hooks/use-editor-shortcuts";

/**
 * Right-click menu for the canvas. Object rows appear when something is
 * selected (right-clicking an object selects it first via Konva's
 * contextmenu event in object-node).
 */
export function EditorContextMenu({ children }: { children: React.ReactNode }) {
  const doc = useDoc();
  const selection = useEditorUiStore((s) => s.selection);
  const hasSelection = selection.length > 0;
  const hasGroup =
    doc?.objects.some((o) => selection.includes(o.id) && o.type === "group") ?? false;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {hasSelection && (
          <>
            <ContextMenuItem onSelect={copySelection}>
              Copy <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => duplicateObjects(selection)}>
              Duplicate <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
        <ContextMenuItem onSelect={pasteClipboard}>
          Paste <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        {hasSelection && (
          <>
            <ContextMenuSeparator />
            {selection.length >= 2 && (
              <ContextMenuItem onSelect={() => groupObjects(selection)}>
                Group <ContextMenuShortcut>⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {hasGroup && (
              <ContextMenuItem onSelect={() => ungroupObjects(selection)}>
                Ungroup <ContextMenuShortcut>⇧⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuItem onSelect={() => reorderObjects(selection, "front")}>
              Bring to front
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => reorderObjects(selection, "forward")}>
              Bring forward
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => reorderObjects(selection, "backward")}>
              Send backward
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => reorderObjects(selection, "back")}>
              Send to back
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => updateObjects(selection, (o) => ({ locked: !o.locked }))}
            >
              Lock / unlock
            </ContextMenuItem>
            <ContextMenuItem
              data-variant="destructive"
              onSelect={() => removeObjects(selection)}
            >
              Delete <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
