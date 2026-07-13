"use client";

import * as React from "react";
import {
  EXTRA_MATERIALS,
  getMaterial,
  getMaterialOption,
  PRIMARY_MATERIALS,
  type MaterialDef,
} from "@/lib/easy/materials";
import type { WizardDraft } from "@/lib/easy/draft";
import { Callout } from "@/components/ui/callout";
import { FinishSwatch } from "../finish-swatch";
import { StickyContinue } from "./vial-step";
import { cn } from "@/lib/utils";

/**
 * Step 2 — the material. Big cards for the four primary choices, a quieter
 * row for the rest, sub-option swatches, and plain-language descriptions:
 * what it looks like, what it's best for, how tough it is, and whether a
 * specialty printer is involved. Simulation notes stay honest.
 */

export function MaterialStep({
  draft,
  update,
  onContinue,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
}) {
  const material = draft.materialId ? getMaterial(draft.materialId) : undefined;
  const option =
    material && draft.materialOptionId
      ? getMaterialOption(material, draft.materialOptionId)
      : undefined;

  const pickMaterial = (m: MaterialDef) => {
    update({
      materialId: m.id,
      materialOptionId: m.defaultOptionId,
      intensity: m.defaultIntensity,
      paletteId: m.defaultPaletteId,
    });
  };

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRIMARY_MATERIALS.map((m) => (
          <li key={m.id}>
            <MaterialCard
              material={m}
              selected={material?.id === m.id}
              onClick={() => pickMaterial(m)}
              large
            />
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          More materials
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {material && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Which {material.name.toLowerCase()}?</p>
          <ul className="flex flex-wrap gap-2">
            {material.options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => update({ materialOptionId: o.id })}
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
            </div>
          )}

          {material.simulationNote && (
            <Callout variant="info" className="text-xs [&>svg]:size-3.5">
              {material.simulationNote}
            </Callout>
          )}
        </div>
      )}

      <StickyContinue disabled={!material} onClick={onContinue} />
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
      <FinishSwatch
        swatch={defaultOption.swatch}
        animated={material.id === "holographic" || material.id === "metallic"}
        className={large ? "h-20 w-full" : "h-12 w-full"}
      />
      <span className="text-sm font-medium">{material.name}</span>
      {large && (
        <span className="text-xs leading-snug text-muted-foreground">
          {material.tagline}
        </span>
      )}
    </button>
  );
}
