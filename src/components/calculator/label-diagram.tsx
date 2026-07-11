import type { LabelCalcResult } from "@/lib/geometry/label-calculator";

/**
 * To-scale schematic of the computed label: bleed area, trim line, and safe
 * zone. The SVG viewBox is in millimeters, so proportions are exact.
 */
export function LabelDiagram({ result }: { result: LabelCalcResult }) {
  const { widthMm, heightMm, bleedMm, safeMm, totalWidthMm, totalHeightMm } = result;
  if (widthMm <= 0 || heightMm <= 0) return null;

  const pad = Math.max(totalWidthMm, totalHeightMm) * 0.06;
  const viewW = totalWidthMm + pad * 2;
  const viewH = totalHeightMm + pad * 2;
  const strokeW = Math.max(totalWidthMm, totalHeightMm) / 320;
  const isRound = result.style === "cap-circle";

  const trimX = pad + bleedMm;
  const trimY = pad + bleedMm;
  const safeX = trimX + safeMm;
  const safeY = trimY + safeMm;
  const safeW = Math.max(widthMm - 2 * safeMm, 0);
  const safeH = Math.max(heightMm - 2 * safeMm, 0);

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full rounded-lg border border-border bg-surface"
        role="img"
        aria-label={`Label diagram: ${widthMm.toFixed(1)} by ${heightMm.toFixed(1)} millimeters with ${bleedMm.toFixed(1)} millimeter bleed and ${safeMm.toFixed(1)} millimeter safe zone`}
      >
        {isRound ? (
          <>
            <circle
              cx={pad + totalWidthMm / 2}
              cy={pad + totalHeightMm / 2}
              r={totalWidthMm / 2}
              className="fill-destructive/10"
            />
            <circle
              cx={pad + totalWidthMm / 2}
              cy={pad + totalHeightMm / 2}
              r={widthMm / 2}
              className="fill-surface stroke-foreground"
              strokeWidth={strokeW}
            />
            <circle
              cx={pad + totalWidthMm / 2}
              cy={pad + totalHeightMm / 2}
              r={Math.max(widthMm / 2 - safeMm, 0)}
              className="fill-transparent stroke-success"
              strokeWidth={strokeW}
              strokeDasharray={`${strokeW * 4} ${strokeW * 3}`}
            />
          </>
        ) : (
          <>
            {/* Bleed */}
            <rect
              x={pad}
              y={pad}
              width={totalWidthMm}
              height={totalHeightMm}
              className="fill-destructive/10"
            />
            {/* Trim */}
            <rect
              x={trimX}
              y={trimY}
              width={widthMm}
              height={heightMm}
              className="fill-surface stroke-foreground"
              strokeWidth={strokeW}
            />
            {/* Safe zone */}
            <rect
              x={safeX}
              y={safeY}
              width={safeW}
              height={safeH}
              className="fill-transparent stroke-success"
              strokeWidth={strokeW}
              strokeDasharray={`${strokeW * 4} ${strokeW * 3}`}
            />
          </>
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-destructive/20" /> Bleed ({result.bleedMm.toFixed(1)} mm)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-3 border-t-2 border-foreground" /> Trim (finished size)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-3 border-t-2 border-dashed border-success" /> Safe zone ({result.safeMm.toFixed(1)} mm)
        </span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bar visualizing how much of the circumference the label covers. */
export function WrapCoverageBar({ result }: { result: LabelCalcResult }) {
  if (result.style === "cap-circle" || result.circumferenceMm <= 0) return null;
  const coverage = Math.min(result.coverageRatio, 1);
  const overlap = result.seamGapMm !== null && result.seamGapMm < 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Wrap coverage</span>
        <span>
          {(result.coverageRatio * 100).toFixed(0)}%
          {overlap && " (overlapping)"}
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`The label covers ${(result.coverageRatio * 100).toFixed(0)} percent of the vial circumference`}
      >
        <div
          className={overlap ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-primary"}
          style={{ width: `${coverage * 100}%` }}
        />
      </div>
    </div>
  );
}
