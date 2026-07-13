"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadDraft, saveDraft, type WizardDraft } from "@/lib/easy/draft";
import { Button } from "@/components/ui/button";
import { VialStep } from "./steps/vial-step";
import { MaterialStep } from "./steps/material-step";
import { StyleStep } from "./steps/style-step";
import { PickStep } from "./steps/pick-step";

/**
 * The guided creation wizard: Choose → Answer → Preview → Print.
 * One decision per screen, a sticky Continue, browser-back = step back,
 * and a localStorage draft so refresh never loses progress. No canvas,
 * no print jargon — the calculator and layout engine do that part.
 */

const STEPS = [
  { id: 0, title: "What are you labeling?" },
  { id: 1, title: "Choose your label material" },
  { id: 2, title: "How should it feel?" },
  { id: 3, title: "Pick your design" },
] as const;

export function CreateWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = Math.min(Math.max(Number(searchParams.get("step") ?? 0) || 0, 0), 3);

  const [draft, setDraft] = React.useState<WizardDraft>(() => ({
    version: 1,
    step: 0,
  }));
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    // Deferred so hydration completes before localStorage state lands
    // (also keeps SSR markup and first client render identical).
    void Promise.resolve().then(() => {
      if (!alive) return;
      const stored = loadDraft();
      if (stored) setDraft(stored);
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = React.useCallback((patch: Partial<WizardDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  const goTo = React.useCallback(
    (nextStep: number) => {
      update({ step: nextStep });
      router.push(`/create?step=${nextStep}`, { scroll: true });
    },
    [router, update],
  );

  // Later steps need earlier answers — bounce back if a refresh lost them.
  React.useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      if (step >= 1 && !draft.presetId) goTo(0);
      else if (step >= 2 && !draft.materialId) goTo(1);
    });
    return () => {
      alive = false;
    };
  }, [hydrated, step, draft.presetId, draft.materialId, goTo]);

  if (!hydrated) return null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col px-4 pb-28 pt-6 sm:px-6">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        {step > 0 ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            onClick={() => goTo(step - 1)}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
        ) : (
          <span className="size-7" aria-hidden />
        )}
        <div className="flex flex-1 items-center gap-1.5" aria-hidden>
          {STEPS.map((s) => (
            <span
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s.id <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {step + 1} / {STEPS.length}
        </span>
      </div>

      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {STEPS[step]!.title}
      </h1>

      <div className="mt-6 flex-1">
        {step === 0 && <VialStep draft={draft} update={update} onContinue={() => goTo(1)} />}
        {step === 1 && (
          <MaterialStep draft={draft} update={update} onContinue={() => goTo(2)} />
        )}
        {step === 2 && <StyleStep draft={draft} update={update} onContinue={() => goTo(3)} />}
        {step === 3 && <PickStep draft={draft} update={update} />}
      </div>
    </div>
  );
}
