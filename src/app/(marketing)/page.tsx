import Link from "next/link";
import {
  ArrowRight,
  Box,
  FileCheck2,
  Layers,
  Printer,
  QrCode,
  Ruler,
  ScanEye,
  Sparkles,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FinishShowcase } from "@/components/marketing/finish-showcase";
import { HeroVial } from "@/components/marketing/hero-vial";
import { PLAN_SEED, formatPlanPrice } from "@/lib/billing/plan-seed";
import { VIAL_PRESETS } from "@/lib/vials/presets";
import { circumference } from "@/lib/geometry/label-calculator";

const WORKFLOW = [
  {
    step: "1",
    title: "Choose your vial",
    body: "Pick a 10, 20, or 30 mL preset — or enter exact measurements. The size calculator turns diameter and wall height into a dimension-accurate canvas with bleed and safe zones.",
  },
  {
    step: "2",
    title: "Design your label",
    body: "Start from a professional template or a blank canvas. Precise text, shapes, images, QR codes, barcodes, and simulated foil & holographic finishes — all in physical millimeters.",
  },
  {
    step: "3",
    title: "Preview & print",
    body: "Check the design on a realistic vial mockup, run the print-readiness check, then export print-ready PDFs or full label sheets for home and commercial printing.",
  },
] as const;

const FEATURES = [
  {
    icon: Ruler,
    title: "Dimension-accurate canvas",
    body: "Everything is measured in real millimeters. What you design is exactly what prints — at 300 or 600 DPI.",
  },
  {
    icon: Type,
    title: "Professional design tools",
    body: "Curved text, custom fonts, alignment guides, snapping, layers, and keyboard shortcuts that feel like real design software.",
  },
  {
    icon: QrCode,
    title: "QR codes & barcodes",
    body: "Native generators for QR, Code 128, EAN-13, UPC-A and more — with scannability checks before you print.",
  },
  {
    icon: Sparkles,
    title: "Foil & holographic previews",
    body: "Simulate gold foil, holographic film, brushed metal, and transparent stock before you commit to a material.",
  },
  {
    icon: Box,
    title: "Realistic vial mockups",
    body: "See your label wrapped on a vial — glass tint, liquid fill, cap style, and the exact seam position.",
  },
  {
    icon: Printer,
    title: "Print-ready output",
    body: "Bleed, trim, safe zones, crop marks, and sheet imposition with printer calibration for perfect alignment.",
  },
  {
    icon: FileCheck2,
    title: "Preflight checks",
    body: "Catch low-resolution images, tiny text, and unscannable codes before they reach the printer.",
  },
  {
    icon: Layers,
    title: "Reusable brand kits",
    body: "Save logos, palettes, fonts, and standard warnings once — apply them to every product in your line.",
  },
  {
    icon: ScanEye,
    title: "Honest previews",
    body: "Screen simulations are labeled as simulations. We help you verify sizes and materials before a full run.",
  },
] as const;

const FAQ = [
  {
    q: "Will the printed label really fit my vial?",
    a: "The calculator derives label dimensions from your vial's measured diameter and straight-wall height (width = circumference − gap), and every export is generated at exact physical size. Vials of the same nominal volume do vary between manufacturers, so we always recommend measuring your exact vial and printing one test label before a full run.",
  },
  {
    q: "Can I print at home?",
    a: "Yes. The print-sheet generator lays out labels on US Letter, A4, or custom sheets for inkjet and laser printers, with crop marks, a calibration page, and per-printer offset adjustment. You can also export single-label PDFs for roll-label and commercial printers.",
  },
  {
    q: "Do the holographic and foil effects print?",
    a: "On-screen finishes are visual simulations to help you choose materials. To physically produce foil or holographic labels you either print onto holographic/metallic stock or order spot-foil printing from a commercial printer — our material guide explains both routes.",
  },
  {
    q: "Who owns my designs?",
    a: "You do. Your projects and uploads remain yours; we claim no rights over your artwork. You're responsible for having rights to the content you upload and for regulatory compliance of your labels.",
  },
  {
    q: "Is Forge Labels suitable for pharmaceutical or medical labeling?",
    a: "Forge Labels is a design tool. It does not certify compliance with FDA, EMA, pharmacopeia, or any other regulatory requirements — you must verify mandatory content, identifiers, and claims for your product category and jurisdiction.",
  },
] as const;

export default function LandingPage() {
  const presets = VIAL_PRESETS.filter((p) => !p.isCustom).filter((p) =>
    ["10ml-serum", "20ml-serum", "30ml-serum"].includes(p.id),
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_70%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div className="space-y-6">
            <Badge variant="default" className="gap-1.5">
              <Sparkles className="size-3" aria-hidden />
              Built for 10–30 mL vials
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              Design professional vial labels{" "}
              <span className="text-primary">in minutes.</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              A specialized design studio for vial labels: dimension-accurate
              canvases from your vial&apos;s real measurements, premium templates,
              realistic mockups, and print-ready exports.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Create your label
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/templates">Browse templates</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Free to try — no account needed to open the editor.
            </p>
          </div>
          <div className="flex items-center justify-center md:justify-end">
            <HeroVial />
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-t border-border bg-subtle/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            From vial to print-ready in three steps
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {WORKFLOW.map((item) => (
              <div key={item.step} className="relative rounded-xl border border-border bg-surface p-6">
                <span className="font-display text-4xl font-bold text-primary/25">
                  {item.step}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vial sizes */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Sized to your exact vial
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Start from editable presets for common vials, or measure your own.
                Label width is derived from the true circumference — no guessing.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/tools/label-calculator">
                Open the size calculator
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {presets.map((preset) => {
              const c = circumference(preset.diameterMm);
              return (
                <Card key={preset.id} className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>{preset.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>⌀ {preset.diameterMm.toFixed(1)} mm · wall {preset.straightWallHeightMm.toFixed(0)} mm</p>
                    <p>Wrap width ≈ {(c - 3).toFixed(1)} mm</p>
                    <p className="pt-1 text-xs">{preset.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Typical dimensions shown — always measure your actual vial before printing.
          </p>
        </div>
      </section>

      {/* Finishes */}
      <section className="border-t border-border bg-subtle/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Preview premium materials before you buy them
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Simulate holographic film, metallic foils, and transparent stock on
            screen — then take the spec to your printer with confidence.
          </p>
          <FinishShowcase className="mt-8" />
          <p className="mt-3 text-xs text-muted-foreground">
            On-screen finishes are simulations; printed results depend on material and printer.
          </p>
        </div>
      </section>

      {/* Feature grid */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Everything a label needs to leave the studio
          </h2>
          <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                  <f.icon className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="border-t border-border bg-subtle/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Simple plans that scale with your product line
            </h2>
            <Button asChild variant="outline">
              <Link href="/pricing">
                Compare all plans
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PLAN_SEED.filter((p) => p.id !== "enterprise").map((plan) => (
              <Card
                key={plan.id}
                className={plan.highlighted ? "border-primary shadow-md" : undefined}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlighted && <Badge>Most popular</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.blurb}</p>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold">
                    {formatPlanPrice(plan.priceMonthlyCents)}
                    {plan.priceMonthlyCents ? (
                      <span className="text-sm font-normal text-muted-foreground"> /month</span>
                    ) : null}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {plan.highlights.slice(0, 4).map((h) => (
                      <li key={h} className="flex gap-2">
                        <span className="text-primary" aria-hidden>
                          ✓
                        </span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            {FAQ.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Your next label, done right.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Open the studio, pick your vial, and export a print-ready label —
            all in one sitting.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Create your label
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tools/label-calculator">Try the calculator</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
