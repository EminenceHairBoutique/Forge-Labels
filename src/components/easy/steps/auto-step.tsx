"use client";

import * as React from "react";
import { getVialPreset } from "@/lib/vials/presets";
import { PRIMARY_MATERIALS, EXTRA_MATERIALS, getMaterial } from "@/lib/easy/materials";
import { STYLE_CHOICES } from "@/lib/easy/recommend";
import type { WizardDraft } from "@/lib/easy/draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinishSwatch } from "../finish-swatch";
import { VialGlyph } from "../vial-glyph";
import { StickyContinue } from "./vial-step";
import { cn } from "@/lib/utils";

/**
 * §13 "Make my label for me": every question on ONE screen, then straight
 * to three complete options. Same engine, same rules — just the shortest
 * possible path through them.
 */

const AUTO_VIALS = ["10ml-serum", "20ml-serum", "30ml-serum", "10ml-dropper"];

export function AutoStep({
  draft,
  update,
  onContinue,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
}) {
  const fields = draft.fields ?? {};
  const materials = [...PRIMARY_MATERIALS, ...EXTRA_MATERIALS];

  const ready = Boolean(draft.presetId && draft.materialId);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Vial</p>
        <ul className="grid grid-cols-4 gap-2">
          {AUTO_VIALS.map((id) => {
            const preset = getVialPreset(id)!;
            const selected = draft.presetId === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => update({ presetId: id })}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-xl border-2 bg-surface p-2 transition-colors",
                    selected
                      ? "border-primary bg-primary-subtle/40"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <VialGlyph preset={preset} className="h-14 text-foreground/70" />
                  <span className="text-[11px] font-medium leading-tight">
                    {preset.nominalVolumeMl} mL
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="auto-brand">Brand name</Label>
          <Input
            id="auto-brand"
            maxLength={40}
            placeholder="e.g. AURELIS LABS"
            value={fields.brand ?? ""}
            onChange={(e) => update({ fields: { ...fields, brand: e.target.value } })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auto-product">Product name</Label>
          <Input
            id="auto-product"
            maxLength={60}
            placeholder="e.g. Retinol Serum"
            value={fields["product-name"] ?? ""}
            onChange={(e) =>
              update({ fields: { ...fields, "product-name": e.target.value } })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auto-strength">Strength or amount</Label>
          <Input
            id="auto-strength"
            maxLength={30}
            placeholder="e.g. 10 mg"
            value={fields.strength ?? ""}
            onChange={(e) => update({ fields: { ...fields, strength: e.target.value } })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Material</p>
        <ul className="flex flex-wrap gap-2">
          {materials.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={draft.materialId === m.id}
                onClick={() =>
                  update({
                    materialId: m.id,
                    materialOptionId: m.defaultOptionId,
                    intensity: m.defaultIntensity,
                    paletteId: m.defaultPaletteId,
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm transition-colors",
                  draft.materialId === m.id
                    ? "border-primary bg-primary-subtle/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <FinishSwatch
                  swatch={getMaterial(m.id)!.options[0]!.swatch}
                  className="size-5"
                />
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="auto-style">Style</Label>
          <Select
            value={draft.styleId ?? "auto"}
            onValueChange={(styleId) =>
              update({ styleId: styleId === "auto" ? undefined : styleId })
            }
          >
            <SelectTrigger id="auto-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Let Forge choose</SelectItem>
              {STYLE_CHOICES.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label id="auto-tone-label">Colors</Label>
          <div role="group" aria-labelledby="auto-tone-label" className="grid grid-cols-3 gap-1.5">
            {(
              [
                { value: false, label: "Light" },
                { value: true, label: "Dark" },
                { value: null, label: "Either" },
              ] as const
            ).map((tone) => (
              <button
                key={tone.label}
                type="button"
                aria-pressed={draft.preferDark === tone.value}
                onClick={() => update({ preferDark: tone.value })}
                className={cn(
                  "rounded-lg border-2 px-2 py-2 text-sm transition-colors",
                  draft.preferDark === tone.value
                    ? "border-primary bg-primary-subtle/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="auto-volume">Net volume (optional)</Label>
          <Input
            id="auto-volume"
            maxLength={30}
            placeholder="e.g. 10 mL / 0.34 fl oz"
            value={fields.volume ?? ""}
            onChange={(e) => update({ fields: { ...fields, volume: e.target.value } })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auto-qr">QR code link (optional)</Label>
          <Input
            id="auto-qr"
            inputMode="url"
            maxLength={500}
            placeholder="https://your-site.example"
            value={fields.qr ?? ""}
            onChange={(e) =>
              update({
                fields: { ...fields, qr: e.target.value },
                wantsQr: Boolean(e.target.value.trim()),
              })
            }
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Have a logo? You can upload it on the very next screen after picking a
        design — everything else is handled here.
      </p>

      <StickyContinue
        disabled={!ready}
        onClick={onContinue}
        label="Make my label"
      />
    </div>
  );
}
