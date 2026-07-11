"use client";

import * as React from "react";
import type { TextObject } from "@/lib/document/schema";
import { updateObject, withGesture } from "@/lib/document/commands";
import { fontPtToMm } from "@/lib/geometry/units";
import { fontCssFamily } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { useEditorUiStore } from "@/stores/editor-ui-store";

interface TextEditOverlayProps {
  obj: TextObject;
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * In-place text editing: an absolutely positioned textarea mirroring the
 * Konva text's metrics over the hidden node. Enter commits, Shift+Enter adds
 * a line, Escape cancels.
 */
export function TextEditOverlay({ obj, zoom, panX, panY }: TextEditOverlayProps) {
  const setEditingTextId = useEditorUiStore((s) => s.setEditingTextId);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const initialText = React.useRef(obj.text);

  const fontSizePx = fontPtToMm(obj.fontSizePt) * zoom;
  const widthPx = obj.widthMm * zoom;
  const heightPx = obj.heightMm * zoom;
  const left = panX + (obj.xMm - obj.widthMm / 2) * zoom;
  const top = panY + (obj.yMm - obj.heightMm / 2) * zoom;

  const commit = React.useCallback(() => {
    const value = ref.current?.value ?? "";
    setEditingTextId(null);
    if (value === initialText.current) return;
    const next: TextObject = { ...obj, text: value };
    withGesture(() => {
      updateObject(obj.id, { text: value, heightMm: measureTextHeightMm(next) });
    });
  }, [obj, setEditingTextId]);

  const cancel = React.useCallback(() => {
    setEditingTextId(null);
  }, [setEditingTextId]);

  React.useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const fillColor = obj.fill.type === "solid" ? obj.fill.color : "#1a1a1a";

  return (
    <textarea
      ref={ref}
      defaultValue={obj.text}
      aria-label="Edit text"
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      className="absolute z-20 resize-none overflow-hidden border border-primary/60 bg-transparent p-0 outline-none"
      style={{
        left,
        top,
        width: Math.max(widthPx, 20),
        minHeight: Math.max(heightPx, fontSizePx * obj.lineHeight),
        fontFamily: fontCssFamily(obj.fontFamilyId),
        fontWeight: obj.fontWeight,
        fontSize: fontSizePx,
        lineHeight: String(obj.lineHeight),
        letterSpacing: `${obj.letterSpacingEm}em`,
        textAlign: obj.align,
        color: fillColor,
        textTransform: obj.textTransform === "none" ? undefined : obj.textTransform,
        transform: `rotate(${obj.rotationDeg}deg)`,
        transformOrigin: "center center",
        caretColor: fillColor,
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
    />
  );
}
