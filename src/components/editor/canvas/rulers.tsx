"use client";

import * as React from "react";
import { fromMm, toMm, type Unit } from "@/lib/geometry/units";

export const RULER_THICKNESS = 22;

/** Tick steps per display unit, chosen so labels stay ≥ ~45px apart. */
const STEP_CANDIDATES: Record<Unit, number[]> = {
  mm: [0.5, 1, 2, 5, 10, 20, 50, 100, 200],
  cm: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
  in: [0.0625, 0.125, 0.25, 0.5, 1, 2, 5, 10],
};

function pickStep(unit: Unit, zoom: number): number {
  const minPx = 45;
  for (const step of STEP_CANDIDATES[unit]) {
    if (toMm(step, unit) * zoom >= minPx) return step;
  }
  return STEP_CANDIDATES[unit].at(-1)!;
}

function formatTick(value: number): string {
  return Math.abs(value) < 1e-9
    ? "0"
    : Number.isInteger(value)
      ? String(value)
      : String(Math.round(value * 1000) / 1000);
}

interface RulersProps {
  zoom: number;
  panX: number;
  panY: number;
  unit: Unit;
  width: number;
  height: number;
}

/**
 * Screen-space measurement rulers along the canvas edges, in the editor's
 * display unit. Zero sits at the label's top-left (trim origin).
 */
export function CanvasRulers({ zoom, panX, panY, unit, width, height }: RulersProps) {
  const hRef = React.useRef<HTMLCanvasElement>(null);
  const vRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue("--panel").trim() || "#fafafa";
    const fg = styles.getPropertyValue("--muted-foreground").trim() || "#71717a";
    const line = styles.getPropertyValue("--border").trim() || "#d4d4d8";

    const step = pickStep(unit, zoom);
    const stepMm = toMm(step, unit);

    const draw = (
      canvas: HTMLCanvasElement | null,
      length: number,
      pan: number,
      horizontal: boolean,
    ) => {
      if (!canvas || length <= 0) return;
      canvas.width = Math.round((horizontal ? length : RULER_THICKNESS) * dpr);
      canvas.height = Math.round((horizontal ? RULER_THICKNESS : length) * dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = bg;
      ctx.fillRect(
        0,
        0,
        horizontal ? length : RULER_THICKNESS,
        horizontal ? RULER_THICKNESS : length,
      );
      ctx.strokeStyle = line;
      ctx.fillStyle = fg;
      ctx.font = "9px ui-sans-serif, system-ui";
      ctx.lineWidth = 1;

      const worldStart = (0 - pan) / zoom; // mm at screen 0
      const firstTick = Math.floor(fromMm(worldStart, unit) / step) * step;

      for (let i = 0; ; i++) {
        const valueUnit = firstTick + i * step;
        const screen = toMm(valueUnit, unit) * zoom + pan;
        if (screen > length) break;
        if (screen < -50) continue;

        const px = Math.round(screen) + 0.5;
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(px, RULER_THICKNESS);
          ctx.lineTo(px, RULER_THICKNESS - 7);
        } else {
          ctx.moveTo(RULER_THICKNESS, px);
          ctx.lineTo(RULER_THICKNESS - 7, px);
        }
        ctx.stroke();

        // Minor ticks (quarters).
        for (let q = 1; q < 4; q++) {
          const minor = screen + (stepMm * zoom * q) / 4;
          if (minor > length) break;
          const mpx = Math.round(minor) + 0.5;
          ctx.beginPath();
          if (horizontal) {
            ctx.moveTo(mpx, RULER_THICKNESS);
            ctx.lineTo(mpx, RULER_THICKNESS - (q === 2 ? 5 : 3));
          } else {
            ctx.moveTo(RULER_THICKNESS, mpx);
            ctx.lineTo(RULER_THICKNESS - (q === 2 ? 5 : 3), mpx);
          }
          ctx.stroke();
        }

        const label = formatTick(valueUnit);
        if (horizontal) {
          ctx.fillText(label, px + 2, 9);
        } else {
          ctx.save();
          ctx.translate(9, px + 2);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = "right";
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }

      // Edge line.
      ctx.strokeStyle = line;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(0, RULER_THICKNESS - 0.5);
        ctx.lineTo(length, RULER_THICKNESS - 0.5);
      } else {
        ctx.moveTo(RULER_THICKNESS - 0.5, 0);
        ctx.lineTo(RULER_THICKNESS - 0.5, length);
      }
      ctx.stroke();
    };

    draw(hRef.current, width, panX, true);
    draw(vRef.current, height, panY, false);
  }, [zoom, panX, panY, unit, width, height]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <canvas
        ref={hRef}
        className="absolute left-0 top-0"
        style={{ width, height: RULER_THICKNESS }}
      />
      <canvas
        ref={vRef}
        className="absolute left-0 top-0"
        style={{ width: RULER_THICKNESS, height }}
      />
      <div
        className="absolute left-0 top-0 border-b border-r border-border bg-panel"
        style={{ width: RULER_THICKNESS, height: RULER_THICKNESS }}
      />
    </div>
  );
}
