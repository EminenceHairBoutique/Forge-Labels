import * as React from "react";
import { cn } from "@/lib/utils";

export type VialGraphicVariant = "violet" | "gold" | "teal" | "noir";

const LABEL_THEMES: Record<
  VialGraphicVariant,
  { band: string; bandText: string; accent: string; liquid: string }
> = {
  violet: { band: "#f5f3ff", bandText: "#4c3d8f", accent: "#7c6ce0", liquid: "#8b7cf0" },
  gold: { band: "#1c1917", bandText: "#e7c878", accent: "#d4af5f", liquid: "#caa64f" },
  teal: { band: "#f0fdfa", bandText: "#0f766e", accent: "#14b8a6", liquid: "#2dd4bf" },
  noir: { band: "#18181b", bandText: "#e4e4e7", accent: "#a1a1aa", liquid: "#52525b" },
};

interface VialGraphicProps {
  /** Rough visual proportions; maps nominal volume to width/height. */
  size?: "10ml" | "20ml" | "30ml";
  variant?: VialGraphicVariant;
  brand?: string;
  product?: string;
  className?: string;
}

/**
 * Stylized SVG vial used on marketing pages (the editor and mockup use the
 * real rendering pipeline — this is illustrative only).
 */
export function VialGraphic({
  size = "10ml",
  variant = "violet",
  brand = "AURELIS",
  product = "Serum No. 4",
  className,
}: VialGraphicProps) {
  const theme = LABEL_THEMES[variant];
  const dims =
    size === "30ml"
      ? { w: 84, h: 190, capH: 26 }
      : size === "20ml"
        ? { w: 72, h: 160, capH: 24 }
        : { w: 60, h: 136, capH: 22 };

  const bodyX = 10;
  const bodyW = dims.w - 20;
  const bodyY = dims.capH + 14;
  const bodyH = dims.h - bodyY - 6;
  const labelY = bodyY + bodyH * 0.28;
  const labelH = bodyH * 0.5;
  const liquidY = bodyY + bodyH * 0.12;
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <svg
      viewBox={`0 0 ${dims.w} ${dims.h}`}
      className={cn("drop-shadow-lg", className)}
      role="img"
      aria-label={`Illustration of a ${size} vial with a ${product} label`}
    >
      <defs>
        <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.18" stopColor="#dbe4ee" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#c8d4e2" stopOpacity="0.12" />
          <stop offset="0.82" stopColor="#dbe4ee" stopOpacity="0.3" />
          <stop offset="1" stopColor="#8fa3b8" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`liquid-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={theme.liquid} stopOpacity="0.8" />
          <stop offset="0.5" stopColor={theme.liquid} stopOpacity="0.55" />
          <stop offset="1" stopColor={theme.liquid} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`cap-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3f3f46" />
          <stop offset="0.5" stopColor="#71717a" />
          <stop offset="1" stopColor="#27272a" />
        </linearGradient>
        <linearGradient id={`band-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.12" />
          <stop offset="0.2" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* Cap */}
      <rect
        x={bodyX + bodyW / 2 - 14}
        y={4}
        width={28}
        height={dims.capH}
        rx={3.5}
        fill={`url(#cap-${uid})`}
      />
      {/* Neck */}
      <rect
        x={bodyX + bodyW / 2 - 9}
        y={dims.capH + 2}
        width={18}
        height={14}
        rx={2}
        fill={`url(#glass-${uid})`}
        stroke="#94a3b8"
        strokeOpacity={0.35}
      />
      {/* Liquid */}
      <rect
        x={bodyX + 3}
        y={liquidY}
        width={bodyW - 6}
        height={bodyY + bodyH - liquidY - 3}
        rx={8}
        fill={`url(#liquid-${uid})`}
      />
      {/* Body glass */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={10}
        fill={`url(#glass-${uid})`}
        stroke="#94a3b8"
        strokeOpacity={0.45}
      />
      {/* Label */}
      <g>
        <rect x={bodyX} y={labelY} width={bodyW} height={labelH} fill={theme.band} />
        <rect
          x={bodyX}
          y={labelY}
          width={bodyW}
          height={labelH}
          fill={`url(#band-${uid})`}
        />
        <text
          x={bodyX + bodyW / 2}
          y={labelY + labelH * 0.32}
          textAnchor="middle"
          fontSize={labelH * 0.14}
          letterSpacing="0.12em"
          fontWeight={700}
          fill={theme.bandText}
          style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
        >
          {brand.toUpperCase()}
        </text>
        <rect
          x={bodyX + bodyW / 2 - 8}
          y={labelY + labelH * 0.42}
          width={16}
          height={1.4}
          fill={theme.accent}
        />
        <text
          x={bodyX + bodyW / 2}
          y={labelY + labelH * 0.62}
          textAnchor="middle"
          fontSize={labelH * 0.11}
          fill={theme.bandText}
          opacity={0.85}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {product}
        </text>
        <text
          x={bodyX + bodyW / 2}
          y={labelY + labelH * 0.82}
          textAnchor="middle"
          fontSize={labelH * 0.09}
          fill={theme.bandText}
          opacity={0.6}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {size.replace("ml", " mL")} · topical
        </text>
      </g>
      {/* Glass highlight */}
      <rect
        x={bodyX + 4}
        y={bodyY + 5}
        width={3.5}
        height={bodyH - 12}
        rx={1.75}
        fill="#ffffff"
        opacity={0.5}
      />
    </svg>
  );
}
