"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadDraft, saveDraft, type WizardDraft } from "@/lib/easy/draft";
import { Button } from "@/components/ui/button";
import { AutoStep } from "./steps/auto-step";
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
  const auto = searchParams.get("auto") === "1";

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
      router.push(`/create?step=${nextStep}${auto ? "&auto=1" : ""}`, { scroll: true });
    },
    [router, update, auto],
  );

  // Later steps need earlier answers — bounce back if a refresh lost them.
  React.useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      if (step >= 1 && !draft.presetId) goTo(0);
      else if (!auto && step >= 2 && !draft.materialId) goTo(1);
    });
    return () => {
      alive = false;
    };
  }, [hydrated, step, auto, draft.presetId, draft.materialId, goTo]);

  // Mark auto drafts so the pick step shows exactly three finished options.
  React.useEffect(() => {
    if (!hydrated || draft.auto === auto) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) update({ auto });
    });
    return () => {
      alive = false;
    };
  }, [hydrated, auto, draft.auto, update]);

  if (!hydrated) return null;

  if (auto) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col px-4 pb-28 pt-6 sm:px-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {step === 3 ? "Your label, three ways" : "Make my label for me"}
        </h1>
        {step !== 3 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Answer once — we&apos;ll design three complete labels you can use
            immediately.
          </p>
        )}
        <div className="mt-6 flex-1">
          {step === 3 ? (
            <PickStep draft={draft} update={update} />
          ) : (
            <AutoStep draft={draft} update={update} onContinue={() => goTo(3)} />
          )}
        </div>
      </div>
    );
  }

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

      {step === 0 && (
        <p className="mt-1 text-sm">
          <Link
            href="/create?auto=1"
            className="text-primary underline-offset-2 hover:underline"
          >
            In a hurry? Make my label for me →
          </Link>
        </p>
      )}

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
