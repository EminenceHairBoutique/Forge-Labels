"use client";

import * as React from "react";
import { calculateLabel } from "@/lib/geometry/label-calculator";
import { getVialPreset, VIAL_PRESETS, type VialPreset } from "@/lib/vials/presets";
import type { GlassId } from "@/lib/easy/templates";
import type { WizardDraft } from "@/lib/easy/draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VialGlyph } from "../vial-glyph";
import { cn } from "@/lib/utils";

/**
 * Step 1 — pick what you're labeling. Visual cards drawn from the real
 * preset proportions; measurements are optional and asked in plain
 * language (wrap a string around the vial — no diameters, no formulas).
 * Technical dimensions stay behind a quiet disclosure.
 */

const GLASS_CHOICES: { id: GlassId; label: string; swatch: string }[] = [
  { id: "clear", label: "Clear", swatch: "linear-gradient(135deg,#f3f6f9,#dfe6ec)" },
  { id: "amber", label: "Amber", swatch: "linear-gradient(135deg,#b4651a,#7c3f0d)" },
  { id: "frosted", label: "Frosted", swatch: "linear-gradient(135deg,#eef1f4,#cfd6dd)" },
  { id: "cobalt", label: "Blue", swatch: "linear-gradient(135deg,#2148a8,#122a66)" },
  { id: "opaque", label: "White", swatch: "linear-gradient(135deg,#ffffff,#e8e8ec)" },
];

const CARD_PRESETS: { presetId: string; title: string; subtitle: string }[] = [
  { presetId: "10ml-serum", title: "10 mL vial", subtitle: "Small serum / peptide vial" },
  { presetId: "10ml-crimp", title: "10 mL crimp top", subtitle: "Injection vial, metal seal" },
  { presetId: "20ml-serum", title: "20 mL vial", subtitle: "Mid-size serum vial" },
  { presetId: "30ml-serum", title: "30 mL bottle", subtitle: "1 oz skincare bottle" },
  { presetId: "10ml-dropper", title: "Dropper bottle", subtitle: "10 mL with dropper top" },
  { presetId: "30ml-dropper", title: "Large dropper", subtitle: "30 mL Boston round" },
  { presetId: "5ml-serum", title: "5 mL mini vial", subtitle: "Small serum vial" },
  { presetId: "2ml-cryo", title: "2 mL cryovial", subtitle: "Frozen-sample tube" },
  { presetId: "50ml-centrifuge", title: "50 mL tube", subtitle: "Centrifuge tube" },
  { presetId: "custom", title: "Something else", subtitle: "Any round bottle or vial" },
];

type Knowledge = NonNullable<WizardDraft["measurements"]>;

export function VialStep({
  draft,
  update,
  onContinue,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
}) {
  const preset = draft.presetId ? getVialPreset(draft.presetId) : undefined;
  const knowledge = draft.measurements;
  const [aroundText, setAroundText] = React.useState(
    draft.diameterMm ? (draft.diameterMm * Math.PI).toFixed(0) : "",
  );
  const [heightText, setHeightText] = React.useState(
    draft.straightWallHeightMm ? String(draft.straightWallHeightMm) : "",
  );

  const customDiameter = aroundText ? Number(aroundText) / Math.PI : undefined;
  const customHeight = heightText ? Number(heightText) : undefined;
  const customValid =
    knowledge !== "custom" ||
    (customDiameter !== undefined &&
      Number.isFinite(customDiameter) &&
      customDiameter >= 8 &&
      customDiameter <= 130 &&
      customHeight !== undefined &&
      Number.isFinite(customHeight) &&
      customHeight >= 8 &&
      customHeight <= 200);

  const effectiveDiameter =
    knowledge === "custom" && customValid ? customDiameter : preset?.diameterMm;
  const effectiveHeight =
    knowledge === "custom" && customValid ? customHeight : preset?.straightWallHeightMm;
  const calc =
    preset && effectiveDiameter && effectiveHeight
      ? calculateLabel({
          diameterMm: effectiveDiameter,
          straightWallHeightMm: effectiveHeight,
          style: "full-wrap",
          neckDiameterMm: preset.neckDiameterMm,
          capDiameterMm: preset.capDiameterMm,
        })
      : null;
  const calcOk = calc !== null && !calc.issues.some((i) => i.severity === "error");

  const pick = (presetId: string) => {
    update({
      presetId,
      measurements: presetId === "custom" ? "custom" : (draft.measurements ?? undefined),
      diameterMm: undefined,
      straightWallHeightMm: undefined,
    });
  };

  const setKnowledge = (k: Knowledge) => {
    update({
      measurements: k,
      diameterMm: undefined,
      straightWallHeightMm: undefined,
    });
  };

  const commitCustom = () => {
    if (customValid && customDiameter && customHeight) {
      update({
        diameterMm: Math.round(customDiameter * 10) / 10,
        straightWallHeightMm: Math.round(customHeight * 10) / 10,
      });
    }
  };

  const canContinue = Boolean(preset) && (knowledge !== "custom" || (customValid && calcOk));

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CARD_PRESETS.map((card) => {
          const p = getVialPreset(card.presetId)!;
          const selected = draft.presetId === card.presetId;
          return (
            <li key={card.presetId}>
              <button
                type="button"
                onClick={() => pick(card.presetId)}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-40 w-full flex-col items-center gap-1 rounded-xl border-2 bg-surface p-3 text-center transition-colors",
                  selected
                    ? "border-primary bg-primary-subtle/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <VialGlyph preset={p} className="h-24 text-foreground/70" />
                <span className="text-sm font-medium">{card.title}</span>
                <span className="text-xs text-muted-foreground">{card.subtitle}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {preset && (
        <div className="space-y-2">
          <p className="text-sm font-medium">What color is your container?</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Container color">
            {GLASS_CHOICES.map((choice) => {
              const selected = (draft.glass ?? preset.defaultGlass) === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ glass: choice.id })}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs transition-colors",
                    selected
                      ? "border-primary bg-primary-subtle/40"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-3.5 rounded-full border border-border"
                    style={{ background: choice.swatch }}
                  />
                  {choice.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Helps us match designs and preview colors — the label fits either way.
          </p>
        </div>
      )}

      {preset && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Do you know the exact measurements?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <KnowledgeButton
              active={knowledge === "custom"}
              onClick={() => setKnowledge("custom")}
              title="Yes, enter them"
              subtitle="Most accurate"
            />
            <KnowledgeButton
              active={knowledge === "preset" || (!knowledge && preset.id !== "custom")}
              onClick={() => setKnowledge("preset")}
              title="No, help me choose"
              subtitle="Use the standard size"
            />
            <KnowledgeButton
              active={knowledge === "later"}
              onClick={() => setKnowledge("later")}
              title="I'll measure later"
              subtitle="You can change it anytime"
            />
          </div>

          {knowledge === "custom" && (
            <div className="space-y-3 rounded-lg bg-subtle p-3">
              <p className="text-sm text-muted-foreground">
                Wrap a strip of paper or string once around the straight part of
                the vial — where the label will sit — and measure it in
                millimeters (1 cm = 10 mm).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vial-around">Around the vial (mm)</Label>
                  <Input
                    id="vial-around"
                    inputMode="decimal"
                    placeholder="e.g. 77"
                    value={aroundText}
                    onChange={(e) => setAroundText(e.target.value)}
                    onBlur={commitCustom}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vial-straight">Straight side height (mm)</Label>
                  <Input
                    id="vial-straight"
                    inputMode="decimal"
                    placeholder="e.g. 30"
                    value={heightText}
                    onChange={(e) => setHeightText(e.target.value)}
                    onBlur={commitCustom}
                  />
                </div>
              </div>
              {!customValid && (aroundText || heightText) && (
                <p className="text-xs text-destructive" role="alert">
                  Those numbers don&apos;t look right — &quot;around the
                  vial&quot; is usually 30–200 mm and the straight side 10–100 mm.
                </p>
              )}
            </div>
          )}

          {(knowledge === "preset" || (!knowledge && preset.id !== "custom")) && (
            <p className="text-sm text-muted-foreground">
              We&apos;ll size everything for a standard {preset.name.toLowerCase()}.
              {" "}You can fine-tune measurements any time.
            </p>
          )}
          {knowledge === "later" && (
            <p className="text-sm text-muted-foreground">
              No problem — we&apos;ll use the standard size for now, and your
              design will adapt if you update the measurements later.
            </p>
          )}

          {calcOk && calc && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none text-primary">
                View technical dimensions
              </summary>
              <p className="mt-2 tabular-nums">
                Label {calc.widthMm.toFixed(1)} × {calc.heightMm.toFixed(1)} mm ·
                extra print area (bleed) {calc.bleedMm} mm · keep-text-inside
                margin {calc.safeMm} mm
                {calc.seamGapMm !== null && ` · gap between label ends ${calc.seamGapMm} mm`}
              </p>
            </details>
          )}
        </div>
      )}

      <StickyContinue disabled={!canContinue} onClick={onContinue} />
    </div>
  );
}

function KnowledgeButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
        active ? "border-primary bg-primary-subtle/40" : "border-border hover:border-primary/40",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-muted-foreground">{subtitle}</span>
    </button>
  );
}

/** Shared sticky footer button for every wizard step. */
export function StickyContinue({
  disabled,
  onClick,
  label = "Continue",
  busy = false,
}: {
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 p-3 backdrop-blur">
      <div className="mx-auto max-w-3xl">
        <Button
          size="lg"
          className="w-full sm:w-auto sm:min-w-56"
          disabled={disabled}
          loading={busy}
          onClick={onClick}
        >
          {label}
        </Button>
      </div>
    </div>
  );
}

/** Re-exported for the pick step: presets the wizard offers. */
export function wizardPreset(draft: WizardDraft): VialPreset | undefined {
  if (!draft.presetId) return undefined;
  return VIAL_PRESETS.find((p) => p.id === draft.presetId);
}
