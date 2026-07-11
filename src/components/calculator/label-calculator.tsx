"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  calculateLabel,
  DEFAULT_BLEED_MM,
  DEFAULT_GAP_MM,
  DEFAULT_NECK_BAND_HEIGHT_MM,
  DEFAULT_SAFE_MM,
  LABEL_STYLE_LABELS,
  type LabelCalcResult,
  type LabelStyle,
} from "@/lib/geometry/label-calculator";
import {
  formatMm,
  fromMm,
  parseToMm,
  UNIT_DISPLAY_DECIMALS,
  type Unit,
} from "@/lib/geometry/units";
import { VIAL_PRESETS, getVialPreset, DEFAULT_VIAL_PRESET_ID } from "@/lib/vials/presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabelDiagram, WrapCoverageBar } from "@/components/calculator/label-diagram";

type DimField =
  | "diameter"
  | "wallHeight"
  | "gap"
  | "bleed"
  | "safe"
  | "height"
  | "neckDiameter"
  | "neckHeight"
  | "capDiameter";

/**
 * Canonical millimeters + the text the user sees. The mm value is the source
 * of truth; text is only a view. Unit switching regenerates text from mm, so
 * display rounding never drifts the underlying measurement.
 */
interface FieldValue {
  mm: number | null;
  text: string;
}

type FieldsState = Record<DimField, FieldValue>;

function toFieldString(mm: number, unit: Unit): string {
  return fromMm(mm, unit).toFixed(UNIT_DISPLAY_DECIMALS[unit]);
}

function makeField(mm: number, unit: Unit): FieldValue {
  return { mm, text: toFieldString(mm, unit) };
}

function buildFields(unit: Unit, values: Record<DimField, number>): FieldsState {
  return Object.fromEntries(
    Object.entries(values).map(([k, mm]) => [k, makeField(mm, unit)]),
  ) as FieldsState;
}

export function LabelCalculator() {
  const [unit, setUnit] = React.useState<Unit>("mm");
  const [presetId, setPresetId] = React.useState(DEFAULT_VIAL_PRESET_ID);
  const [style, setStyle] = React.useState<LabelStyle>("full-wrap");
  const [coveragePct, setCoveragePct] = React.useState(60);
  const [panelPct, setPanelPct] = React.useState(40);
  const [useHeightOverride, setUseHeightOverride] = React.useState(false);

  const initialPreset = getVialPreset(DEFAULT_VIAL_PRESET_ID)!;
  const [fields, setFields] = React.useState<FieldsState>(() =>
    buildFields("mm", {
      diameter: initialPreset.diameterMm,
      wallHeight: initialPreset.straightWallHeightMm,
      gap: DEFAULT_GAP_MM,
      bleed: DEFAULT_BLEED_MM,
      safe: DEFAULT_SAFE_MM,
      height: initialPreset.straightWallHeightMm - 4,
      neckDiameter: initialPreset.neckDiameterMm,
      neckHeight: DEFAULT_NECK_BAND_HEIGHT_MM,
      capDiameter: initialPreset.capDiameterMm,
    }),
  );

  const mmValue = React.useCallback(
    (field: DimField): number | null => fields[field].mm,
    [fields],
  );

  function setField(field: DimField, text: string) {
    setFields((f) => ({ ...f, [field]: { text, mm: parseToMm(text, unit) } }));
  }

  function switchUnit(next: Unit) {
    if (next === unit) return;
    setFields((f) => {
      const converted = { ...f };
      for (const key of Object.keys(f) as DimField[]) {
        const field = f[key];
        // Regenerate text from canonical mm so display rounding never
        // accumulates into the measurement itself.
        if (field.mm !== null) converted[key] = makeField(field.mm, next);
      }
      return converted;
    });
    setUnit(next);
  }

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = getVialPreset(id);
    if (!preset) return;
    setStyle(preset.defaultLabelStyle);
    setUseHeightOverride(false);
    setFields((f) => ({
      ...f,
      diameter: makeField(preset.diameterMm, unit),
      wallHeight: makeField(preset.straightWallHeightMm, unit),
      height: makeField(Math.max(preset.straightWallHeightMm - 4, 0), unit),
      neckDiameter: makeField(preset.neckDiameterMm, unit),
      capDiameter: makeField(preset.capDiameterMm, unit),
    }));
  }

  const diameterMm = mmValue("diameter");
  const wallHeightMm = mmValue("wallHeight");

  const result: LabelCalcResult | null =
    diameterMm !== null && wallHeightMm !== null
      ? calculateLabel({
          diameterMm,
          straightWallHeightMm: wallHeightMm,
          style,
          gapMm: mmValue("gap") ?? DEFAULT_GAP_MM,
          coverageRatio: coveragePct / 100,
          panelRatio: panelPct / 100,
          bleedMm: mmValue("bleed") ?? DEFAULT_BLEED_MM,
          safeMm: mmValue("safe") ?? DEFAULT_SAFE_MM,
          heightMm: useHeightOverride ? (mmValue("height") ?? undefined) : undefined,
          neckDiameterMm: mmValue("neckDiameter") ?? undefined,
          neckBandHeightMm: mmValue("neckHeight") ?? undefined,
          capDiameterMm: mmValue("capDiameter") ?? undefined,
        })
      : null;

  const errors = result?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = result?.issues.filter((i) => i.severity === "warning") ?? [];
  const infos = result?.issues.filter((i) => i.severity === "info") ?? [];
  const hasError = errors.length > 0 || !result;

  const dim = (field: DimField, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`calc-${field}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`calc-${field}`}
          inputMode="decimal"
          value={fields[field].text}
          onChange={(e) => setField(field, e.target.value)}
          aria-invalid={mmValue(field) === null}
          className="pr-10"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
      {/* Inputs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Vial &amp; label setup</CardTitle>
          <ToggleGroup
            type="single"
            value={unit}
            onValueChange={(v) => v && switchUnit(v as Unit)}
            aria-label="Measurement unit"
          >
            <ToggleGroupItem value="mm">mm</ToggleGroupItem>
            <ToggleGroupItem value="cm">cm</ToggleGroupItem>
            <ToggleGroupItem value="in">in</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="calc-preset">Vial preset</Label>
            <Select value={presetId} onValueChange={applyPreset}>
              <SelectTrigger id="calc-preset">
                <SelectValue placeholder="Choose a vial" />
              </SelectTrigger>
              <SelectContent>
                {VIAL_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Presets are starting points — every value below stays editable.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {dim("diameter", "Body diameter", "Measure across the vial at the label area.")}
            {dim("wallHeight", "Straight-wall height", "The cylindrical section only — stop where the glass curves.")}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="calc-style">Label style</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as LabelStyle)}>
              <SelectTrigger id="calc-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LABEL_STYLE_LABELS) as LabelStyle[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {LABEL_STYLE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {style === "full-wrap" &&
            dim("gap", "Seam gap", "Distance between label ends. Negative values overlap.")}

          {style === "partial-wrap" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="calc-coverage">Circumference coverage</Label>
                <span className="text-sm text-muted-foreground">{coveragePct}%</span>
              </div>
              <Slider
                id="calc-coverage"
                min={10}
                max={100}
                step={1}
                value={[coveragePct]}
                onValueChange={([v]) => setCoveragePct(v ?? 60)}
                aria-label="Circumference coverage percentage"
              />
            </div>
          )}

          {(style === "front-only" || style === "front-back") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="calc-panel">Panel width (of circumference)</Label>
                <span className="text-sm text-muted-foreground">{panelPct}%</span>
              </div>
              <Slider
                id="calc-panel"
                min={10}
                max={50}
                step={1}
                value={[panelPct]}
                onValueChange={([v]) => setPanelPct(v ?? 40)}
                aria-label="Panel width as percentage of circumference"
              />
            </div>
          )}

          {style === "neck-band" && (
            <div className="grid grid-cols-2 gap-4">
              {dim("neckDiameter", "Neck diameter", "Measure the neck, not the body.")}
              {dim("neckHeight", "Band height")}
            </div>
          )}

          {style === "cap-circle" && dim("capDiameter", "Cap diameter")}

          {style !== "cap-circle" && style !== "neck-band" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="calc-height-override"
                  type="checkbox"
                  checked={useHeightOverride}
                  onChange={(e) => setUseHeightOverride(e.target.checked)}
                  className="size-4 accent-(--primary)"
                />
                <Label htmlFor="calc-height-override">Set label height manually</Label>
              </div>
              {useHeightOverride &&
                dim("height", "Label height", "Defaults to the straight wall minus 4 mm of clearance.")}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {dim("bleed", "Bleed", "Artwork extends this far past the trim.")}
            {dim("safe", "Safe zone", "Keep text and codes inside this inset.")}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-5">
        {hasError ? (
          <Callout variant="destructive" title="Can't compute a label from these values">
            <ul className="list-disc space-y-1 pl-4">
              {errors.length > 0 ? (
                errors.map((e) => <li key={e.code}>{e.message}</li>)
              ) : (
                <li>Enter valid numeric measurements to see results.</li>
              )}
            </ul>
          </Callout>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Your label dimensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="font-display text-3xl font-bold tracking-tight">
                    {formatMm(result.widthMm, unit, { suffix: false })} ×{" "}
                    {formatMm(result.heightMm, unit)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    finished (trim) size{result.panels === 2 ? " · 2 panels" : ""}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-3">
                  <ResultStat label="With bleed" value={`${formatMm(result.totalWidthMm, unit, { suffix: false })} × ${formatMm(result.totalHeightMm, unit)}`} />
                  <ResultStat label="Safe area" value={`${formatMm(result.safeWidthMm, unit, { suffix: false })} × ${formatMm(result.safeHeightMm, unit)}`} />
                  <ResultStat label="Circumference" value={formatMm(result.circumferenceMm, unit)} />
                  {result.seamGapMm !== null && (
                    <ResultStat
                      label={result.seamGapMm < 0 ? "Overlap" : "Seam gap"}
                      value={formatMm(Math.abs(result.seamGapMm), unit)}
                    />
                  )}
                  <ResultStat label="Printable area" value={`${result.printableAreaCm2.toFixed(1)} cm²`} />
                  <ResultStat label="Recommended print" value={`${result.recommendedDpi} DPI`} />
                  <ResultStat label="Minimum font size" value={`${result.recommendedMinFontPt} pt`} />
                </dl>

                <WrapCoverageBar result={result} />
                <LabelDiagram result={result} />

                <Button asChild className="w-full sm:w-auto">
                  <Link
                    href={`/editor/new?preset=${presetId}&style=${style}&d=${diameterMm}&h=${wallHeightMm}`}
                  >
                    Design this label
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {warnings.map((w) => (
              <Callout key={w.code} variant="warning">
                {w.message}
              </Callout>
            ))}
            {infos.map((i) => (
              <Callout key={i.code} variant="info">
                {i.message}
              </Callout>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
