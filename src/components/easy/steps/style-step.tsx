"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { STYLE_CHOICES } from "@/lib/easy/recommend";
import type { WizardDraft } from "@/lib/easy/draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StickyContinue } from "./vial-step";
import { cn } from "@/lib/utils";

/**
 * Step 3 — the feel, then optional brand questions. No template gallery
 * yet: these answers drive the recommendations on the next screen, where
 * every option already carries the user's own words.
 */

export function StyleStep({
  draft,
  update,
  onContinue,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  onContinue: () => void;
}) {
  const fields = draft.fields ?? {};

  const setField = (slot: "brand" | "product-name" | "strength", value: string) => {
    update({ fields: { ...fields, [slot]: value } });
  };

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {STYLE_CHOICES.map((style) => (
          <li key={style.id}>
            <button
              type="button"
              onClick={() => update({ styleId: style.id })}
              aria-pressed={draft.styleId === style.id}
              className={cn(
                "min-h-20 w-full rounded-xl border-2 bg-surface p-3 text-left transition-colors",
                draft.styleId === style.id
                  ? "border-primary bg-primary-subtle/40"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="block text-sm font-medium">{style.name}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {style.blurb}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => update({ styleId: undefined })}
            aria-pressed={!draft.styleId}
            className={cn(
              "min-h-20 w-full rounded-xl border-2 border-dashed bg-surface p-3 text-left transition-colors",
              !draft.styleId
                ? "border-primary bg-primary-subtle/40"
                : "border-border hover:border-primary/40",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              Let Forge choose
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              We&apos;ll pick a balanced mix for you.
            </span>
          </button>
        </li>
      </ul>

      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">
          Tell us about the product{" "}
          <span className="font-normal text-muted-foreground">
            (optional — your designs will use these words)
          </span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="style-brand">Brand name</Label>
            <Input
              id="style-brand"
              placeholder="e.g. AURELIS LABS"
              maxLength={40}
              value={fields.brand ?? ""}
              onChange={(e) => setField("brand", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="style-product">Product name</Label>
            <Input
              id="style-product"
              placeholder="e.g. Retinol Serum"
              maxLength={60}
              value={fields["product-name"] ?? ""}
              onChange={(e) => setField("product-name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="style-strength">Amount or strength</Label>
            <Input
              id="style-strength"
              placeholder="e.g. 0.5% · 10 mg"
              maxLength={30}
              value={fields.strength ?? ""}
              onChange={(e) => setField("strength", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label id="style-tone-label">Light or dark label?</Label>
            <div
              role="group"
              aria-labelledby="style-tone-label"
              className="grid grid-cols-3 gap-1.5"
            >
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
      </div>

      <StickyContinue onClick={onContinue} label="Continue" />
    </div>
  );
}
