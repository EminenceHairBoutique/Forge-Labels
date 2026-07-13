"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getVialPreset } from "@/lib/vials/presets";
import {
  buildEasyDocument,
  DEFAULT_ENABLED,
} from "@/lib/easy/create-doc";
import { ensureEasyFonts } from "@/lib/easy/fields";
import { getEasyTemplate } from "@/lib/easy/templates";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { getStorageAdapter } from "@/lib/storage";
import type { SlotId } from "@/lib/easy/slots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";

/**
 * §16 — first-run onboarding: five plain steps, no tutorial wall, and a
 * one-click sample project to poke at. Shown once (localStorage flag);
 * everything it promises is what the wizard actually does.
 */

const SEEN_KEY = "forge-labels:onboarded:v1";

const STEPS = [
  "Choose your vial",
  "Pick how it should look",
  "Enter your information",
  "Preview it on the vial",
  "Print or download",
];

export function Onboarding() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      try {
        if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
      } catch {
        // Storage blocked — skip onboarding rather than nag every visit.
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  async function makeSample() {
    setBusy(true);
    try {
      const template = getEasyTemplate("luxury-center")!;
      await ensureEasyFonts(template);
      const doc = buildEasyDocument(
        {
          preset: getVialPreset("10ml-serum")!,
          templateId: template.id,
          materialId: "plain",
          materialOptionId: "plain-cream",
          paletteId: "cream-brown",
          fields: {
            brand: "AURELIS LABS",
            "product-name": "Renewal Serum",
            subtitle: "Sample label — edit anything",
            strength: "0.5%",
            volume: "10 mL / 0.34 fl oz",
          },
          enabled: new Set<SlotId>([...DEFAULT_ENABLED, "subtitle"]),
        },
        measureTextHeightMm,
      );
      const project = await getStorageAdapter().createProject({
        name: "Sample: Renewal Serum",
        doc,
      });
      dismiss();
      router.push(`/easy/${project.id}`);
    } catch (err) {
      toast.error(
        "Couldn't create the sample",
        err instanceof Error ? err.message : undefined,
      );
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Forge Labels</DialogTitle>
          <DialogDescription>
            You don&apos;t need design experience. Forge Labels handles sizing,
            spacing, and print setup for you.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2">
          <Button asChild onClick={dismiss}>
            <Link href="/create">
              <Sparkles className="size-4" aria-hidden />
              Make my first label
            </Link>
          </Button>
          <Button variant="outline" loading={busy} onClick={() => void makeSample()}>
            Try a sample label instead
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={dismiss}>
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
