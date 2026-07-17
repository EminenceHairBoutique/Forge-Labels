"use client";

import * as React from "react";
import {
  Atom,
  Beaker,
  Cross,
  Dna,
  Droplets,
  FlaskConical,
  Flower2,
  Leaf,
  Package,
  Pill,
  Sparkles,
  TestTube,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { INDUSTRIES, type IndustryId } from "@/lib/easy/industries";
import type { WizardDraft } from "@/lib/easy/draft";
import { cn } from "@/lib/utils";
import { StickyContinue } from "./vial-step";

/**
 * §5 — "What type of label are you creating?" The purpose steers
 * templates, suggested fields, notices, and density. Purely a design
 * direction: picking "Pharmaceutical-inspired" changes typography and
 * layout, never regulatory status.
 */

const ICONS: Record<IndustryId, LucideIcon> = {
  "research-peptide": TestTube,
  "lab-reagent": Beaker,
  pharmaceutical: Pill,
  biotechnology: Dna,
  "medical-office": Cross,
  skincare: Droplets,
  cosmetic: Sparkles,
  wellness: Leaf,
  "essential-oil": FlaskConical,
  supplement: Package,
  botanical: Flower2,
  general: Atom,
  custom: Wand2,
};

export function IndustryStep({
  draft,
  update,
  onContinue,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
}) {
  const pick = (id: IndustryId) => {
    const industry = INDUSTRIES.find((i) => i.id === id)!;
    update({
      industry: id,
      // Sensible defaults the user can still change on later steps.
      styleId: draft.styleId ?? industry.defaultStyleId,
      wantsQr: draft.wantsQr ?? (industry.suggestsQr ? true : undefined),
    });
  };

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {INDUSTRIES.map((industry) => {
          const Icon = ICONS[industry.id];
          const selected = draft.industry === industry.id;
          return (
            <li key={industry.id}>
              <button
                type="button"
                onClick={() => pick(industry.id)}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-24 w-full flex-col gap-1 rounded-xl border-2 bg-surface p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary-subtle/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <Icon className="size-4 text-primary" aria-hidden />
                <span className="text-sm font-medium">{industry.name}</span>
                <span className="text-xs text-muted-foreground">{industry.blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        This shapes the designs and fields we suggest — it never adds
        approvals, certifications, or claims to your label.
      </p>
      <StickyContinue disabled={!draft.industry} onClick={onContinue} />
    </div>
  );
}
