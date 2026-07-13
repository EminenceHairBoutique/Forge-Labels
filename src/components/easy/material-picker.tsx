"use client";

import * as React from "react";
import {
  EXTRA_MATERIALS,
  getMaterial,
  getMaterialOption,
  PRIMARY_MATERIALS,
  type Intensity,
  type MaterialDef,
} from "@/lib/easy/materials";
import { Callout } from "@/components/ui/callout";
import { FinishSwatch } from "./finish-swatch";
import { ReactiveShine } from "./reactive-swatch";
import { cn } from "@/lib/utils";

/**
 * The material experience, shared by the wizard's step 2 and the Easy
 * editor's "Material" section: big animated cards for the four primary
 * materials, a quieter row for the rest, sub-option swatches, an intensity
 * control where the material actually varies, and plain-language
 * descriptions with honest simulation/specialty notes.
 */

export interface MaterialSelection {
  materialId: string;
  optionId: string;
  intensity: Intensity;
}

const INTENSITY_LABELS: Record<string, { question: string; options: [Intensity, string][] }> = {
  holographic: {
    question: "How much holographic effect?",
    options: [
      ["subtle", "Subtle"],
      ["balanced", "Balanced"],
      ["bold", "Bold"],
      ["maximum", "Maximum"],
    ],
  },
  neon: {
    question: "Neon intensity",
    options: [
      ["subtle", "Subtle"],
      ["balanced", "Bright"],
      ["bold", "Bolder"],
      ["maximum", "Maximum impact"],
    ],
  },
  metallic: {
    question: "How much metallic shine?",
    options: [
      ["subtle", "Subtle"],
      ["balanced", "Balanced"],
      ["bold", "Bold"],
      ["maximum", "Maximum"],
    ],
  },
};

function intensityVaries(material: MaterialDef): boolean {
  return new Set(Object.values(material.rules.coverage)).size > 1;
}

export function MaterialPicker({
  value,
  onChange,
  compact = false,
}: {
  value: MaterialSelection | null;
  onChange: (next: MaterialSelection) => void;
  /** Compact mode (Easy editor): smaller cards, no tagline copy. */
  compact?: boolean;
}) {
  const material = value ? getMaterial(value.materialId) : undefined;
  const option =
    material && value ? getMaterialOption(material, value.optionId) : undefined;

  const pickMaterial = (m: MaterialDef) => {
    onChange({
      materialId: m.id,
      optionId: m.defaultOptionId,
      intensity: m.defaultIntensity,
    });
  };

  const intensityUi = material ? INTENSITY_LABELS[material.id] : undefined;

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      <ul className={cn("grid grid-cols-2 gap-3", compact ? "sm:grid-cols-4 gap-2" : "sm:grid-cols-4")}>
        {PRIMARY_MATERIALS.map((m) => (
          <li key={m.id}>
            <MaterialCard
              material={m}
              selected={material?.id === m.id}
              onClick={() => pickMaterial(m)}
              large={!compact}
            />
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          More materials
        </p>
        <ul className={cn("grid grid-cols-2 gap-3", compact ? "sm:grid-cols-4 gap-2" : "sm:grid-cols-4")}>
          {EXTRA_MATERIALS.map((m) => (
            <li key={m.id}>
              <MaterialCard
                material={m}
                selected={material?.id === m.id}
                onClick={() => pickMaterial(m)}
              />
            </li>
          ))}
        </ul>
      </div>

      {material && value && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Which {material.name.toLowerCase()}?</p>
          <ul className="flex flex-wrap gap-2">
            {material.options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, optionId: o.id })}
                  aria-pressed={option?.id === o.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm transition-colors",
                    option?.id === o.id
                      ? "border-primary bg-primary-subtle/40"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <FinishSwatch swatch={o.swatch} className="size-6" />
                  {o.name}
                </button>
              </li>
            ))}
          </ul>

          {intensityUi && intensityVaries(material) && (
            <div className="space-y-1.5">
              <p id={`intensity-${material.id}`} className="text-sm font-medium">
                {intensityUi.question}
              </p>
              <div
                role="group"
                aria-labelledby={`intensity-${material.id}`}
                className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              >
                {intensityUi.options.map(([level, label]) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={value.intensity === level}
                    onClick={() => onChange({ ...value, intensity: level })}
                    className={cn(
                      "rounded-lg border-2 px-2 py-2 text-sm transition-colors",
                      value.intensity === level
                        ? "border-primary bg-primary-subtle/40"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {option && (
            <div className="space-y-1.5 rounded-lg bg-subtle p-3 text-sm">
              <p className="font-medium">
                {material.name} — {option.name}
              </p>
              <p className="text-muted-foreground">{option.description}</p>
              <dl className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex gap-1.5">
                  <dt className="font-medium text-foreground/80">Best for:</dt>
                  <dd>{option.bestFor}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="font-medium text-foreground/80">Durability:</dt>
                  <dd>{option.durability}</dd>
                </div>
              </dl>
              {option.specialtyPrinter && (
                <p className="text-xs text-muted-foreground">
                  A specialty label material is required — most online label
                  printers offer it.
                </p>
              )}
              {material.rules.whiteInkNote && (
                <p className="text-xs text-muted-foreground">
                  {material.rules.whiteInkNote}
                </p>
              )}
            </div>
          )}

          {material.simulationNote && (
            <Callout variant="info" className="text-xs [&>svg]:size-3.5">
              {material.simulationNote}
            </Callout>
          )}
        </div>
      )}
    </div>
  );
}

function MaterialCard({
  material,
  selected,
  onClick,
  large = false,
}: {
  material: MaterialDef;
  selected: boolean;
  onClick: () => void;
  large?: boolean;
}) {
  const defaultOption = getMaterialOption(material, material.defaultOptionId);
  const shiny = material.id === "holographic" || material.id === "metallic";
  const swatch = (
    <FinishSwatch
      swatch={defaultOption.swatch}
      animated={shiny}
      className={large ? "h-20 w-full" : "h-12 w-full"}
    />
  );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border-2 bg-surface p-3 text-left transition-colors",
        selected ? "border-primary bg-primary-subtle/40" : "border-border hover:border-primary/40",
      )}
    >
      {shiny ? <ReactiveShine>{swatch}</ReactiveShine> : swatch}
      <span className="text-sm font-medium">{material.name}</span>
      {large && (
        <span className="text-xs leading-snug text-muted-foreground">
          {material.tagline}
        </span>
      )}
    </button>
  );
}
