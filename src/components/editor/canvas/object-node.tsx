"use client";

import * as React from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  RegularPolygon,
  Star,
  Text,
  TextPath,
} from "react-konva";
import type { LabelObject, TextObject } from "@/lib/document/schema";
import { updateObject, updateObjects, withGesture } from "@/lib/document/commands";
import {
  applySessionSnap,
  beginDragSession,
  dragSession,
  endDragSession,
  type DragSibling,
} from "@/lib/editor/snap-session";
import { aabbAt } from "@/lib/editor/snapping";
import { useDocumentStore } from "@/stores/document-store";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import {
  codeGroupConfig,
  ellipseNodeConfig,
  imageGroupConfig,
  imageNodeConfig,
  lineNodeConfig,
  polygonNodeConfig,
  curvedTextBox,
  rectNodeConfig,
  starNodeConfig,
  textNodeConfig,
  textPathNodeConfig,
} from "@/lib/render/node-configs";
import { renderQrToCanvas } from "@/lib/codes/qr";
import { renderBarcodeToCanvas } from "@/lib/codes/barcode";
import { applyImageFilters, filterCacheKey } from "@/lib/render/image-filters";
import { mmToPx } from "@/lib/geometry/units";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { useObjectImage } from "./use-object-image";

/** Screen rendering density for generated code canvases (px per mm). */
const CODE_SCREEN_DPI = 220;

interface ObjectNodeProps {
  obj: LabelObject;
  /** Nested children of groups render without their own interactions. */
  interactive?: boolean;
}

function useInteraction(obj: LabelObject, interactive: boolean) {
  const tool = useEditorUiStore((s) => s.tool);
  const spacePanning = useEditorUiStore((s) => s.spacePanning);
  const editing = useEditorUiStore((s) => s.editingTextId) === obj.id;

  const draggable =
    interactive && tool === "select" && !obj.locked && !spacePanning && !editing;

  const onClick = React.useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!interactive) return;
      e.cancelBubble = true;
      const ui = useEditorUiStore.getState();
      if (obj.locked) {
        ui.setSelection([obj.id]);
        return;
      }
      const shift = "shiftKey" in e.evt && e.evt.shiftKey;
      if (shift) ui.toggleSelected(obj.id);
      else ui.setSelection([obj.id]);
    },
    [interactive, obj.id, obj.locked],
  );

  // Right-click selects before the DOM contextmenu bubbles to the menu.
  const onContextMenu = React.useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!interactive) return;
      e.cancelBubble = true;
      const ui = useEditorUiStore.getState();
      if (!ui.selection.includes(obj.id)) ui.setSelection([obj.id]);
    },
    [interactive, obj.id],
  );

  const onDragStart = React.useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const ui = useEditorUiStore.getState();
      const doc = useDocumentStore.getState().doc;
      if (!ui.selection.includes(obj.id)) ui.setSelection([obj.id]);
      if (!doc) return;

      // Co-selected objects follow the dragged one (multi-drag).
      const node = e.target;
      const stage = node.getStage();
      const selectedIds = useEditorUiStore.getState().selection;
      const siblings: DragSibling[] = [];
      if (stage) {
        for (const id of selectedIds) {
          if (id === obj.id) continue;
          const sibling = stage.findOne(`#${id}`);
          if (sibling) {
            siblings.push({ id, node: sibling, startX: sibling.x(), startY: sibling.y() });
          }
        }
      }
      beginDragSession(
        doc,
        new Set(selectedIds),
        { x: node.x(), y: node.y() },
        siblings,
      );
    },
    [obj.id],
  );

  const onDragMove = React.useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const sessionState = dragSession();
      if (!sessionState) return;
      const ui = useEditorUiStore.getState();
      const node = e.target;

      if (ui.snapEnabled) {
        const thresholdMm = 5 / ui.zoom;
        const box = aabbAt(obj, node.x(), node.y());
        const snap = applySessionSnap(box, thresholdMm);
        if (snap) {
          if (snap.dx !== 0 || snap.dy !== 0) {
            node.position({ x: node.x() + snap.dx, y: node.y() + snap.dy });
          }
          ui.setSnapGuides(snap.guideX, snap.guideY);
        }
      } else {
        ui.setSnapGuides(null, null);
      }

      // Move co-selected siblings by the same delta.
      const dx = node.x() - sessionState.primaryStart.x;
      const dy = node.y() - sessionState.primaryStart.y;
      for (const sibling of sessionState.siblings) {
        sibling.node.position({ x: sibling.startX + dx, y: sibling.startY + dy });
      }
    },
    [obj],
  );

  const onDragEnd = React.useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const sessionState = dragSession();
      const positions = new Map<string, { x: number; y: number }>();
      positions.set(obj.id, { x: node.x(), y: node.y() });
      if (sessionState) {
        for (const sibling of sessionState.siblings) {
          positions.set(sibling.id, { x: sibling.node.x(), y: sibling.node.y() });
        }
      }
      withGesture(() => {
        updateObjects([...positions.keys()], (o) => {
          const pos = positions.get(o.id)!;
          return { xMm: pos.x, yMm: pos.y };
        });
      });
      endDragSession();
      useEditorUiStore.getState().setSnapGuides(null, null);
    },
    [obj.id],
  );

  const onTransformEnd = React.useCallback(
    (e: KonvaEventObject<Event>) => {
      const node = e.target as Konva.Node;
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      const base = {
        xMm: node.x(),
        yMm: node.y(),
        rotationDeg: node.rotation(),
      };

      withGesture(() => {
        switch (obj.type) {
          case "text": {
            if (obj.curve) {
              const s = Math.max(sx, sy);
              const radiusMm = Math.max(obj.curve.radiusMm * s, 2);
              const fontSizePt = Math.max(obj.fontSizePt * s, 1.5);
              updateObject(obj.id, {
                ...base,
                fontSizePt,
                curve: { ...obj.curve, radiusMm },
                ...curvedTextBox(radiusMm, fontSizePt),
              });
              return;
            }
            const widthMm = Math.max(obj.widthMm * sx, 2);
            const fontSizePt = Math.max(obj.fontSizePt * sy, 1);
            const next: TextObject = { ...obj, ...base, widthMm, fontSizePt };
            updateObject(obj.id, {
              ...base,
              widthMm,
              fontSizePt,
              heightMm: measureTextHeightMm(next),
            });
            return;
          }
          case "line":
            updateObject(obj.id, { ...base, widthMm: Math.max(obj.widthMm * sx, 1) });
            return;
          case "polygon":
          case "star":
          case "qrcode": {
            const size = Math.max(Math.min(obj.widthMm, obj.heightMm) * sx, 2);
            updateObject(obj.id, { ...base, widthMm: size, heightMm: size });
            return;
          }
          case "barcode": {
            if (obj.symbology === "datamatrix") {
              const size = Math.max(Math.min(obj.widthMm, obj.heightMm) * sx, 2);
              updateObject(obj.id, { ...base, widthMm: size, heightMm: size });
              return;
            }
            updateObject(obj.id, {
              ...base,
              widthMm: Math.max(obj.widthMm * sx, 2),
              heightMm: Math.max(obj.heightMm * sy, 2),
            });
            return;
          }
          default:
            updateObject(obj.id, {
              ...base,
              widthMm: Math.max(obj.widthMm * sx, 0.5),
              heightMm: Math.max(obj.heightMm * sy, 0.5),
            });
        }
      });
    },
    [obj],
  );

  return {
    draggable,
    onClick,
    onTap: onClick,
    onContextMenu,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformEnd,
  };
}

function TextNode({ obj, events }: { obj: TextObject; events: ReturnType<typeof useInteraction> }) {
  const editing = useEditorUiStore((s) => s.editingTextId) === obj.id;
  const setEditingTextId = useEditorUiStore((s) => s.setEditingTextId);

  if (obj.curve) {
    // Curved text edits through the properties panel (straight-line overlay
    // would misrepresent the arc), so no dblclick editor here.
    return <TextPath {...textPathNodeConfig(obj)} {...events} />;
  }

  const config = textNodeConfig(obj);
  return (
    <Text
      {...config}
      visible={config.visible && !editing}
      {...events}
      onDblClick={() => !obj.locked && setEditingTextId(obj.id)}
      onDblTap={() => !obj.locked && setEditingTextId(obj.id)}
    />
  );
}

function ImageNode({
  obj,
  events,
}: {
  obj: Extract<LabelObject, { type: "image" }>;
  events: ReturnType<typeof useInteraction>;
}) {
  const source = useObjectImage(obj.source);
  const filterKey = filterCacheKey(obj.filters);
  const image = React.useMemo(
    () => (source ? applyImageFilters(source, obj.filters) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters compared by value key
    [source, filterKey],
  );
  return (
    <Group {...imageGroupConfig(obj)} {...events}>
      {image ? (
        <KonvaImage {...imageNodeConfig(obj, image)} />
      ) : (
        <Rect
          width={obj.widthMm}
          height={obj.heightMm}
          fill="#e5e5ea"
          stroke="#a1a1aa"
          strokeWidth={0.2}
          dash={[1.5, 1]}
        />
      )}
    </Group>
  );
}

function QrNode({
  obj,
  events,
}: {
  obj: Extract<LabelObject, { type: "qrcode" }>;
  events: ReturnType<typeof useInteraction>;
}) {
  const logo = useObjectImage(obj.logo?.source ?? null);
  const canvas = React.useMemo(() => {
    try {
      return renderQrToCanvas(obj, {
        targetPx: Math.max(mmToPx(obj.widthMm, CODE_SCREEN_DPI), 96),
        logoImage: logo ?? undefined,
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate on content-affecting fields only
  }, [
    obj.value,
    obj.ecLevel,
    obj.fgColor,
    obj.bgColor,
    obj.moduleShape,
    obj.quietModules,
    obj.logo?.sizeRatio,
    obj.widthMm,
    logo,
  ]);

  return (
    <Group {...codeGroupConfig(obj)} {...events}>
      {canvas ? (
        <KonvaImage image={canvas} width={obj.widthMm} height={obj.heightMm} listening={false} />
      ) : (
        <Rect
          width={obj.widthMm}
          height={obj.heightMm}
          stroke="#b91c1c"
          strokeWidth={0.3}
          dash={[1.5, 1]}
        />
      )}
    </Group>
  );
}

function BarcodeNode({
  obj,
  events,
}: {
  obj: Extract<LabelObject, { type: "barcode" }>;
  events: ReturnType<typeof useInteraction>;
}) {
  const canvas = React.useMemo(() => {
    try {
      return renderBarcodeToCanvas(obj, {
        targetPx: Math.max(mmToPx(obj.widthMm, CODE_SCREEN_DPI), 128),
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate on content-affecting fields only
  }, [obj.symbology, obj.value, obj.showText, obj.fgColor, obj.bgColor, obj.widthMm]);

  return (
    <Group {...codeGroupConfig(obj)} {...events}>
      {canvas ? (
        <KonvaImage image={canvas} width={obj.widthMm} height={obj.heightMm} listening={false} />
      ) : (
        <Rect
          width={obj.widthMm}
          height={obj.heightMm}
          stroke="#b91c1c"
          strokeWidth={0.3}
          dash={[1.5, 1]}
        />
      )}
    </Group>
  );
}

export function ObjectNode({ obj, interactive = true }: ObjectNodeProps) {
  const events = useInteraction(obj, interactive);

  switch (obj.type) {
    case "text":
      return <TextNode obj={obj} events={events} />;
    case "rect":
      return <Rect {...rectNodeConfig(obj)} {...events} />;
    case "ellipse":
      return <Ellipse {...ellipseNodeConfig(obj)} {...events} />;
    case "line":
      return <Line {...lineNodeConfig(obj)} {...events} />;
    case "polygon":
      return <RegularPolygon {...polygonNodeConfig(obj)} {...events} />;
    case "star":
      return <Star {...starNodeConfig(obj)} {...events} />;
    case "image":
      return <ImageNode obj={obj} events={events} />;
    case "qrcode":
      return <QrNode obj={obj} events={events} />;
    case "barcode":
      return <BarcodeNode obj={obj} events={events} />;
    case "group":
      return (
        <Group
          id={obj.id}
          x={obj.xMm}
          y={obj.yMm}
          offsetX={obj.widthMm / 2}
          offsetY={obj.heightMm / 2}
          rotation={obj.rotationDeg}
          opacity={obj.opacity}
          visible={obj.visible}
          {...events}
        >
          {obj.children.map((child) => (
            <ObjectNode key={child.id} obj={child} interactive={false} />
          ))}
        </Group>
      );
  }
}
