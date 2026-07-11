"use client";

import * as React from "react";
import Konva from "konva";
import { Transformer } from "react-konva";
import { useDoc } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { findObject } from "@/lib/document/commands";

interface SelectionTransformerProps {
  stageRef: React.RefObject<Konva.Stage | null>;
}

/**
 * Single Transformer bound to the current selection. Lives on the unscaled
 * overlay layer so anchors stay constant-size; it tracks nodes in the scaled
 * content group through their absolute transforms.
 */
export function SelectionTransformer({ stageRef }: SelectionTransformerProps) {
  const trRef = React.useRef<Konva.Transformer>(null);
  const selection = useEditorUiStore((s) => s.selection);
  const editingTextId = useEditorUiStore((s) => s.editingTextId);
  const doc = useDoc();

  const selectedObjects = React.useMemo(
    () => (doc ? selection.map((id) => findObject(doc, id)).filter((o) => o !== null) : []),
    [doc, selection],
  );

  const anyLocked = selectedObjects.some((o) => o.locked);
  const single = selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Anchor policy per object type.
  let enabledAnchors: string[] | undefined;
  let keepRatio = false;
  if (single) {
    switch (single.type) {
      case "text":
        if (single.curve) {
          enabledAnchors = ["top-left", "top-right", "bottom-left", "bottom-right"];
          keepRatio = true;
        }
        break;
      case "line":
        enabledAnchors = ["middle-left", "middle-right"];
        break;
      case "qrcode":
        enabledAnchors = ["top-left", "top-right", "bottom-left", "bottom-right"];
        keepRatio = true;
        break;
      case "polygon":
      case "star":
        enabledAnchors = ["top-left", "top-right", "bottom-left", "bottom-right"];
        keepRatio = true;
        break;
      case "barcode":
        keepRatio = single.symbology === "datamatrix";
        if (keepRatio) {
          enabledAnchors = ["top-left", "top-right", "bottom-left", "bottom-right"];
        }
        break;
      case "image":
        keepRatio = true; // corners keep ratio; side anchors still free
        break;
      default:
        break;
    }
  }

  React.useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (editingTextId !== null) {
      tr.nodes([]);
      return;
    }
    const nodes = selection
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => Boolean(n))
      .filter((n) => {
        const obj = doc ? findObject(doc, n.id()) : null;
        return obj ? !obj.locked : false;
      });
    tr.nodes(nodes);
  }, [selection, doc, stageRef, editingTextId]);

  if (selection.length === 0 || anyLocked) {
    // Locked objects show selection via the layers panel instead of handles.
  }

  return (
    <Transformer
      ref={trRef}
      rotateEnabled={!anyLocked}
      resizeEnabled={!anyLocked}
      enabledAnchors={anyLocked ? [] : enabledAnchors}
      keepRatio={keepRatio}
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
      rotationSnapTolerance={4}
      anchorSize={9}
      anchorCornerRadius={2}
      anchorStroke="#6d5ce0"
      anchorFill="#ffffff"
      borderStroke="#6d5ce0"
      ignoreStroke
      flipEnabled={false}
      boundBoxFunc={(oldBox, newBox) => {
        if (Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4) {
          return oldBox;
        }
        return newBox;
      }}
    />
  );
}
