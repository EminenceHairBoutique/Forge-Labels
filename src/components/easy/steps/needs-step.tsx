"use client";

import * as React from "react";
import { QrCode, Barcode, ImagePlus } from "lucide-react";
import type { WizardDraft } from "@/lib/easy/draft";
import type { ContentDensity } from "@/lib/easy/templates";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { StickyContinue } from "./vial-step";

/**
 * Step 4 — "What needs to fit?" (§7). One primary decision (how much
 * information) plus three yes/no extras. The answers steer the
 * recommendations: dense templates for detailed labels, QR-forward
 * layouts when a code matters, room reserved when a logo is coming.
 */

const DENSITIES: {
  id: ContentDensity;
  title: string;
  blurb: string;
}[] = [
  {
    id: "minimal",
    title: "Just the basics",
    blurb: "Brand, product name, strength, size — clean and quiet.",
  },
  {
    id: "standard",
    title: "The usual details",
    blurb: "The basics plus a line or two — description, website, batch.",
  },
  {
    id: "detailed",
    title: "Lots of details",
    blurb: "Ingredients, directions, warnings, codes — everything on one label.",
  },
];

export function NeedsStep({
  draft,
  update,
  onContinue,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
}) {
  const density = draft.density ?? "standard";
  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-3">
        {DENSITIES.map((option) => {
          const selected = density === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => update({ density: option.id })}
                className={cn(
                  "h-full w-full rounded-xl border-2 bg-surface p-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary-subtle/30"
                    : "border-border hover:border-primary/40",
                )}
              >
                <p className="text-sm font-semibold">{option.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {option.blurb}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Anything special?
        </p>
        <ExtraToggle
          icon={<QrCode className="size-4" aria-hidden />}
          label="I want a QR code"
          hint="We'll favor layouts that give the code room to scan."
          checked={draft.wantsQr ?? false}
          onChange={(on) => update({ wantsQr: on })}
        />
        <ExtraToggle
          icon={<Barcode className="size-4" aria-hidden />}
          label="I need a barcode"
          hint="For retail or inventory scanning."
          checked={draft.wantsBarcode ?? false}
          onChange={(on) => update({ wantsBarcode: on })}
        />
        <ExtraToggle
          icon={<ImagePlus className="size-4" aria-hidden />}
          label="I have a logo"
          hint="You can upload it right after picking a design."
          checked={draft.hasLogo ?? false}
          onChange={(on) => update({ hasLogo: on })}
        />
      </div>

      <StickyContinue onClick={onContinue} label="Show my designs" />
    </div>
  );
}

function ExtraToggle({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
