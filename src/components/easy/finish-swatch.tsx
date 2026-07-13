"use client";

import * as React from "react";
import { generateFinishTile } from "@/lib/finishes/patterns";
import type { MaterialOption } from "@/lib/easy/materials";
import { cn } from "@/lib/utils";

/**
 * Material swatch: real finish tiles for holographic/metallic options
 * (the same procedural patterns the exports use — preview parity), flat or
 * duo color chips otherwise. Holographic tiles get a slow sheen sweep so
 * the "it moves" quality reads even before B2's pointer-reactive cards.
 */
export function FinishSwatch({
  swatch,
  animated = false,
  className,
}: {
  swatch: MaterialOption["swatch"];
  animated?: boolean;
  className?: string;
}) {
  const [tileUrl, setTileUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (swatch.kind !== "finish") return;
    const finishId = swatch.finishId;
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      const tile = generateFinishTile(finishId, { intensity: 0.9 });
      if (tile) setTileUrl(tile.toDataURL());
    });
    return () => {
      alive = false;
    };
  }, [swatch]);

  if (swatch.kind === "color") {
    return (
      <span
        className={cn("block rounded-md border border-border/60", className)}
        style={{ backgroundColor: swatch.color }}
        aria-hidden
      />
    );
  }
  if (swatch.kind === "duo") {
    return (
      <span
        className={cn("block rounded-md border border-border/60", className)}
        style={{
          background: `linear-gradient(120deg, ${swatch.a} 0 50%, ${swatch.b} 50% 100%)`,
        }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn(
        "relative block overflow-hidden rounded-md border border-border/60 bg-muted",
        className,
      )}
      aria-hidden
    >
      {tileUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- generated tile
        <img
          src={tileUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {animated && (
        <span className="easy-sheen pointer-events-none absolute inset-0 motion-reduce:hidden" />
      )}
    </span>
  );
}
