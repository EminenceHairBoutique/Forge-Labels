import * as React from "react";
import type { VialPreset } from "@/lib/vials/presets";

/**
 * Lightweight SVG vial illustration drawn from a preset's real
 * proportions — wizard cards stay honest about relative size and shape
 * without loading the 3D scene.
 */
export function VialGlyph({
  preset,
  className,
  labelColor = "var(--color-primary, #4c3d8f)",
}: {
  preset: VialPreset;
  className?: string;
  labelColor?: string;
}) {
  // Normalize into a 100×130 viewBox, preserving aspect ratio.
  const totalH = preset.totalHeightMm;
  const bodyD = preset.diameterMm;
  const scale = Math.min(96 / totalH, 60 / bodyD);
  const bodyW = bodyD * scale;
  const capW = preset.capDiameterMm * scale;
  const capH = preset.capHeightMm * scale;
  const bodyH = (totalH - preset.capHeightMm) * scale;
  const labelH = Math.min(preset.straightWallHeightMm * scale * 0.82, bodyH * 0.7);
  const cx = 50;
  const bottom = 118;
  const bodyTop = bottom - bodyH;
  const isDropper = preset.capStyle === "dropper";
  const isPump = preset.capStyle === "pump";

  return (
    <svg
      viewBox="0 0 100 130"
      className={className}
      aria-hidden
      role="presentation"
    >
      {/* Body */}
      <rect
        x={cx - bodyW / 2}
        y={bodyTop}
        width={bodyW}
        height={bodyH}
        rx={3.5}
        fill="color-mix(in srgb, currentColor 8%, transparent)"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={2}
      />
      {/* Liquid */}
      <rect
        x={cx - bodyW / 2 + 2.5}
        y={bodyTop + bodyH * 0.42}
        width={bodyW - 5}
        height={bodyH * 0.55}
        rx={2.5}
        fill="currentColor"
        opacity={0.14}
      />
      {/* Label band */}
      <rect
        x={cx - bodyW / 2 - 1}
        y={bottom - labelH - bodyH * 0.12}
        width={bodyW + 2}
        height={labelH}
        rx={2}
        fill={labelColor}
        opacity={0.9}
      />
      <rect
        x={cx - bodyW / 2 + 4}
        y={bottom - labelH - bodyH * 0.12 + labelH * 0.28}
        width={bodyW - 8}
        height={2.4}
        rx={1.2}
        fill="white"
        opacity={0.9}
      />
      <rect
        x={cx - bodyW / 2 + 4}
        y={bottom - labelH - bodyH * 0.12 + labelH * 0.48}
        width={bodyW * 0.55}
        height={2}
        rx={1}
        fill="white"
        opacity={0.6}
      />
      {/* Cap */}
      {isDropper ? (
        <>
          <rect x={cx - capW / 2} y={bodyTop - capH * 0.35} width={capW} height={capH * 0.35} rx={2} fill="currentColor" opacity={0.8} />
          <ellipse cx={cx} cy={bodyTop - capH * 0.68} rx={capW * 0.32} ry={capH * 0.38} fill="currentColor" opacity={0.65} />
        </>
      ) : isPump ? (
        <>
          <rect x={cx - capW / 2} y={bodyTop - capH * 0.45} width={capW} height={capH * 0.45} rx={2} fill="currentColor" opacity={0.8} />
          <rect x={cx - capW * 0.14} y={bodyTop - capH * 0.8} width={capW * 0.28} height={capH * 0.4} fill="currentColor" opacity={0.7} />
          <rect x={cx - capW * 0.14} y={bodyTop - capH * 0.85} width={capW * 0.5} height={capH * 0.14} rx={1} fill="currentColor" opacity={0.7} />
        </>
      ) : (
        <rect
          x={cx - capW / 2}
          y={bodyTop - capH * 0.75}
          width={capW}
          height={capH * 0.75}
          rx={2}
          fill="currentColor"
          opacity={0.8}
        />
      )}
    </svg>
  );
}
