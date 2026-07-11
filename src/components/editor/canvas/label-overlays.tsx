"use client";

import * as React from "react";
import { Circle, Group, Line, Rect } from "react-konva";
import type { LabelDocument } from "@/lib/document/schema";
import { getSubstrate } from "@/lib/finishes/types";
import { fillToKonvaProps, type KonvaFillProps } from "@/lib/render/fills";

/** Checkerboard tile signaling a transparent background (editor only). */
let checkerboardTile: HTMLCanvasElement | null = null;

function getCheckerboard(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (checkerboardTile) return checkerboardTile;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#e4e4e7";
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillRect(8, 8, 8, 8);
  checkerboardTile = c;
  return c;
}

/**
 * The label base: bleed-extended artwork area with the document background,
 * plus a paper shadow. Rendered beneath the content layer.
 */
export function LabelBase({ doc, zoom }: { doc: LabelDocument; zoom: number }) {
  const checker = getCheckerboard();
  const b = doc.label.bleedMm;
  const w = doc.label.widthMm + 2 * b;
  const h = doc.label.heightMm + 2 * b;
  const isCircle = doc.label.shape === "circle";

  // Transparent backgrounds preview the physical substrate: a stock color,
  // a simulated material tile, or (for clear film) a checkerboard.
  let bgProps: KonvaFillProps | Record<string, unknown>;
  if (doc.background.type === "none") {
    const substrate = getSubstrate(doc.substrateId);
    if (substrate?.previewFinishId) {
      bgProps = fillToKonvaProps(
        {
          type: "finish",
          finishId: substrate.previewFinishId,
          intensity: 0.85,
          scale: 1,
          angleDeg: 0,
        },
        { width: w, height: h },
      );
    } else if (substrate?.previewColor) {
      bgProps = { fill: substrate.previewColor };
    } else if (checker) {
      bgProps = {
        fillPatternImage: checker as unknown as HTMLImageElement,
        fillPatternRepeat: "repeat",
        fillPatternScaleX: 1 / zoom,
        fillPatternScaleY: 1 / zoom,
      };
    } else {
      bgProps = { fill: "#ffffff" };
    }
  } else {
    bgProps = fillToKonvaProps(
      doc.background.type === "solid"
        ? { type: "solid", color: doc.background.color }
        : doc.background.type === "linear-gradient"
          ? {
              type: "linear-gradient",
              angleDeg: doc.background.angleDeg,
              stops: doc.background.stops,
            }
          : {
              type: "finish",
              finishId: doc.background.finishId,
              intensity: doc.background.intensity,
              scale: doc.background.scale,
              angleDeg: doc.background.angleDeg,
            },
      { width: w, height: h },
    );
  }

  if (isCircle) {
    const r = Math.max(w, h) / 2;
    return (
      <Circle
        x={doc.label.widthMm / 2}
        y={doc.label.heightMm / 2}
        radius={r}
        {...bgProps}
        shadowColor="#000000"
        shadowOpacity={0.25}
        shadowBlur={3}
        shadowOffsetY={1}
        listening={false}
      />
    );
  }

  return (
    <Rect
      x={-b}
      y={-b}
      width={w}
      height={h}
      cornerRadius={Math.min(doc.label.cornerRadiusMm + b, Math.min(w, h) / 2)}
      {...bgProps}
      shadowColor="#000000"
      shadowOpacity={0.25}
      shadowBlur={3}
      shadowOffsetY={1}
      listening={false}
    />
  );
}

/**
 * Print guides: bleed boundary (red dashed), trim line (solid), safe zone
 * (green dashed), and center lines. Stroke widths compensate for zoom so the
 * guides stay hairline on screen.
 */
export function LabelGuides({ doc, zoom }: { doc: LabelDocument; zoom: number }) {
  const showGuides = doc.label.bleedMm >= 0;
  if (!showGuides) return null;

  const px = 1 / zoom; // 1 screen px in mm
  const dash = [4 * px, 3 * px];
  const b = doc.label.bleedMm;
  const s = doc.label.safeMm;
  const w = doc.label.widthMm;
  const h = doc.label.heightMm;
  const isCircle = doc.label.shape === "circle";

  if (isCircle) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(w, h) / 2;
    return (
      <Group listening={false}>
        <Circle x={cx} y={cy} radius={r + b} stroke="#dc4444" strokeWidth={px} dash={dash} />
        <Circle x={cx} y={cy} radius={r} stroke="#52525b" strokeWidth={px} />
        <Circle x={cx} y={cy} radius={Math.max(r - s, 0)} stroke="#3f9660" strokeWidth={px} dash={dash} />
      </Group>
    );
  }

  return (
    <Group listening={false}>
      {/* Bleed */}
      <Rect
        x={-b}
        y={-b}
        width={w + 2 * b}
        height={h + 2 * b}
        stroke="#dc4444"
        strokeWidth={px}
        dash={dash}
      />
      {/* Trim */}
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        cornerRadius={doc.label.cornerRadiusMm}
        stroke="#52525b"
        strokeWidth={px}
      />
      {/* Safe zone */}
      <Rect
        x={s}
        y={s}
        width={Math.max(w - 2 * s, 0)}
        height={Math.max(h - 2 * s, 0)}
        stroke="#3f9660"
        strokeWidth={px}
        dash={dash}
      />
      {/* Center lines */}
      <Line points={[w / 2, -b, w / 2, h + b]} stroke="#8b7cf0" strokeWidth={px} dash={[2 * px, 4 * px]} opacity={0.6} />
      <Line points={[-b, h / 2, w + b, h / 2]} stroke="#8b7cf0" strokeWidth={px} dash={[2 * px, 4 * px]} opacity={0.6} />
    </Group>
  );
}
