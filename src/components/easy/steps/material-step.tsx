"use client";

import * as React from "react";
import { getMaterial } from "@/lib/easy/materials";
import type { WizardDraft } from "@/lib/easy/draft";
import { MaterialPicker, type MaterialSelection } from "../material-picker";
import { StickyContinue } from "./vial-step";

/**
 * Step 2 — the material. All the actual UI lives in MaterialPicker (shared
 * with the Easy editor's Material section); this step just binds it to the
 * wizard draft.
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
  const value: MaterialSelection | null =
    draft.materialId && draft.materialOptionId
      ? {
          materialId: draft.materialId,
          optionId: draft.materialOptionId,
          intensity:
            draft.intensity ??
            getMaterial(draft.materialId)?.defaultIntensity ??
            "balanced",
        }
      : null;

  return (
    <div className="space-y-6">
      <MaterialPicker
        value={value}
        onChange={(next) =>
          update({
            materialId: next.materialId,
            materialOptionId: next.optionId,
            intensity: next.intensity,
            paletteId: getMaterial(next.materialId)?.defaultPaletteId,
          })
        }
      />
      <StickyContinue disabled={!value} onClick={onContinue} />
    </div>
  );
}
