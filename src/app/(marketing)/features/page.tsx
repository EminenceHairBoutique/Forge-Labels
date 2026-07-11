import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Barcode,
  Box,
  Calculator,
  Crop,
  Crosshair,
  FileCheck2,
  FileSpreadsheet,
  FolderKanban,
  GlassWater,
  Grid3x3,
  History,
  Image as ImageIcon,
  Keyboard,
  Layers,
  LayoutGrid,
  Magnet,
  Palette,
  Printer,
  QrCode,
  Rotate3d,
  Ruler,
  ScanLine,
  Shapes,
  Sparkles,
  Spline,
  Type,
  Undo2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything in the Forge Labels studio: the vial label size calculator, a millimeter-accurate design editor, QR & barcodes, simulated premium finishes, 3D vial mockups, and print-ready exports.",
};

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: "Business plan" | "Coming soon";
}

interface Section {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  features: Feature[];
  note?: string;
}

const SECTIONS: Section[] = [
  {
    id: "measure",
    eyebrow: "Sizing",
    title: "Measure once, print exactly",
    lead: "Vial labels fail when the math is wrong. Forge Labels starts from your vial's real measurements and keeps every pixel tied to a physical millimeter, all the way to the printed sheet.",
    features: [
      {
        icon: Calculator,
        title: "Label size calculator",
        body: "Enter a diameter and wall height — or pick a 10/20/30 mL preset — and get exact label dimensions for full wraps, partial wraps, front panels, neck bands, and cap stickers. Full-wrap width is true circumference minus your seam gap.",
      },
      {
        icon: Ruler,
        title: "Millimeter-accurate canvas",
        body: "The editor canvas is the label at physical size. Positions, font sizes, and stroke widths are all real-world units, so a 6 mm logo on screen is a 6 mm logo on the vial.",
      },
      {
        icon: Crop,
        title: "Bleed, trim & safe zones",
        body: "Every canvas shows the 2 mm bleed, the trim line, and the 3 mm safe zone. Backgrounds extend into the bleed; text stays inside the safe zone — the guides make it hard to get wrong.",
      },
    ],
    note: "Vials of the same nominal volume vary between manufacturers — the calculator and every export flow remind you to measure your actual vial first.",
  },
  {
    id: "editor",
    eyebrow: "Design",
    title: "A real design editor",
    lead: "Not a form with three text boxes — a proper canvas editor built for small-format label work.",
    features: [
      {
        icon: Type,
        title: "Precise text tools",
        body: "Multiple text blocks with font, size, weight, letter spacing, line height, and alignment controls — measured in points and millimeters, tuned for tiny type.",
      },
      {
        icon: Spline,
        title: "Curved text",
        body: "Set text on an arc for seals, badges, and around-the-cap layouts, with adjustable radius and direction.",
      },
      {
        icon: Shapes,
        title: "Shapes & frames",
        body: "Rectangles, rounded rectangles, circles, lines, and borders with exact stroke widths — the backbone of clean label structure.",
      },
      {
        icon: ImageIcon,
        title: "Image uploads",
        body: "Place logos and artwork, scale and crop them on the canvas, and get warned by preflight when the effective resolution drops below print quality.",
      },
      {
        icon: Layers,
        title: "Layers, lock & group",
        body: "A full layers panel with reordering, visibility, locking, and grouping — so a finished background stays put while you iterate on the foreground.",
      },
      {
        icon: Magnet,
        title: "Snapping & smart guides",
        body: "Objects snap to the canvas center, edges, safe zone, and each other, with smart alignment guides while you drag.",
      },
      {
        icon: Ruler,
        title: "Rulers & guides",
        body: "Millimeter rulers along both axes keep placement honest on a canvas that is only a few centimeters tall.",
      },
      {
        icon: Undo2,
        title: "Undo / redo history",
        body: "Step backward and forward through your edits with confidence — nothing is ever one wrong click from lost.",
      },
      {
        icon: Keyboard,
        title: "Keyboard shortcuts",
        body: "Ctrl/Cmd+Z, duplicate, nudge with arrow keys, zoom, and more — the shortcuts you expect from desktop design tools.",
      },
    ],
  },
  {
    id: "codes",
    eyebrow: "Codes",
    title: "Codes that scan",
    lead: "QR codes and barcodes are generated natively on the canvas — vector-sharp at any DPI, and checked for scannability before you print.",
    features: [
      {
        icon: QrCode,
        title: "QR codes",
        body: "Encode URLs, plain text, vCards, and Wi-Fi credentials with selectable error-correction levels (L/M/Q/H) and styling for module color and corner finishes.",
      },
      {
        icon: Barcode,
        title: "Retail & logistics barcodes",
        body: "Code 128, Code 39, EAN-13, UPC-A, and DataMatrix — with correct quiet zones and check digits handled for you.",
      },
      {
        icon: ScanLine,
        title: "Scannability validation",
        body: "Preflight flags codes rendered too small for their data density, low-contrast color pairs, and quiet-zone violations — before a printed batch teaches you the hard way.",
      },
    ],
  },
  {
    id: "finishes",
    eyebrow: "Materials",
    title: "Materials & finishes, simulated honestly",
    lead: "Preview how artwork reads on premium stock before you order it. Pick a finish and the canvas and mockup render it live.",
    features: [
      {
        icon: Sparkles,
        title: "Holographic variants",
        body: "Rainbow, linear-beam, and micro-glitter holographic simulations that shift with the mockup's rotation.",
      },
      {
        icon: Palette,
        title: "Gold, silver & rose foil",
        body: "Simulated metallic foil for text, shapes, and accents — plus brushed-metal texture for an industrial look.",
      },
      {
        icon: GlassWater,
        title: "Clear, frosted & kraft stock",
        body: "See your design on transparent film over glass or liquid, on frosted film, or on warm kraft paper — with matte and gloss surface options.",
      },
    ],
    note: "On-screen finishes are simulations to help you choose materials. Printed results depend on the physical stock and process — see the materials guide for how foil and holographic labels are actually produced.",
  },
  {
    id: "mockup",
    eyebrow: "Preview",
    title: "See it on the vial",
    lead: "A flat rectangle lies to you. The 3D mockup wraps your label around the actual cylinder geometry so you can judge it the way a customer will.",
    features: [
      {
        icon: Rotate3d,
        title: "Rotate & inspect",
        body: "Spin the vial to check how the design reads from every angle, and exactly where the wrap seam lands.",
      },
      {
        icon: GlassWater,
        title: "Glass, cap & liquid",
        body: "Switch glass tints — clear, amber, cobalt, frosted — and preview cap styles and liquid fill so the label is judged in context.",
      },
      {
        icon: Box,
        title: "Seam preview",
        body: "The seam gap from the calculator is drawn on the mockup, so you can keep critical content away from the join before you commit.",
      },
    ],
  },
  {
    id: "print",
    eyebrow: "Output",
    title: "Print with confidence",
    lead: "The last step is the one that costs money. Forge Labels treats print output as a first-class feature, not an afterthought.",
    features: [
      {
        icon: FileCheck2,
        title: "Preflight checks",
        body: "One click scans the design for low-resolution images, type below the minimum size, content outside the safe zone, and codes unlikely to scan.",
      },
      {
        icon: Printer,
        title: "Print-ready PDF",
        body: "Export a PDF at exact physical size with bleed and crop marks — the file a commercial printer expects to receive.",
      },
      {
        icon: LayoutGrid,
        title: "Sheet imposition",
        body: "Lay out repeated labels on US Letter, A4, or custom sheet sizes with configurable margins and spacing for home and office printing.",
      },
      {
        icon: Crosshair,
        title: "Printer calibration",
        body: "Print the calibration page, measure the offset, enter the X/Y correction — and every subsequent sheet lands where it should.",
      },
      {
        icon: Grid3x3,
        title: "300 & 600 DPI raster",
        body: "PNG export at 300 DPI as standard, or 600 DPI for very small labels, fine detail, and micro text.",
      },
      {
        icon: FileCheck2,
        title: "SVG vector export",
        body: "Resolution-independent vector output for professional workflows, cutting plotters, and downstream editing.",
      },
    ],
  },
  {
    id: "teams",
    eyebrow: "Workflow",
    title: "Built for teams and brands",
    lead: "A label is rarely a one-off. Keep your product line consistent and your production runs repeatable.",
    features: [
      {
        icon: Palette,
        title: "Brand kits",
        body: "Save logos, color palettes, fonts, and standard warning text once, then apply them to every label in your range.",
      },
      {
        icon: FolderKanban,
        title: "Projects & autosave",
        body: "Every design is a project that saves automatically as you work — to your account in cloud mode, or to your browser in local demo mode.",
      },
      {
        icon: History,
        title: "Version history",
        body: "Paid plans keep versions of your project so you can compare and restore earlier states of a design.",
      },
      {
        icon: FileSpreadsheet,
        title: "CSV batch labels",
        body: "Generate a labeled batch from a spreadsheet — names, lot numbers, serials, and per-row QR data merged into one template.",
        badge: "Business plan",
      },
      {
        icon: Layers,
        title: "Production layers",
        body: "Separate white-ink, foil, and spot-UV layers exported the way commercial presses expect them.",
        badge: "Business plan",
      },
      {
        icon: Users,
        title: "Team collaboration",
        body: "Share projects and brand assets across up to five seats so the whole team designs from the same source of truth.",
        badge: "Business plan",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_70%_-10%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <Badge className="gap-1.5">
            <Sparkles className="size-3" aria-hidden />
            The full tour
          </Badge>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Every feature, built around one job:{" "}
            <span className="text-primary">a label that fits, scans, and prints.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Forge Labels is a specialized studio for 10–30 mL vial labels. From
            the first measurement to the final sheet on your printer, here is
            what is inside.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Open the studio
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tools/label-calculator">Try the size calculator</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature sections */}
      {SECTIONS.map((section, i) => (
        <section
          key={section.id}
          id={section.id}
          className={
            i % 2 === 0 ? "border-t border-border bg-subtle/60" : "border-t border-border"
          }
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {section.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {section.title}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{section.lead}</p>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {section.features.map((f) => (
                <div key={f.title} className="flex gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                    <f.icon className="size-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="flex flex-wrap items-center gap-2 font-medium">
                      {f.title}
                      {f.badge && (
                        <Badge variant="secondary" className="text-[11px]">
                          {f.badge}
                        </Badge>
                      )}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {f.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {section.note && (
              <Callout variant="info" className="mt-10 max-w-3xl">
                {section.note}
              </Callout>
            )}
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            See it all in one sitting.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            The editor is free to open — design a label for your vial, run
            preflight, and export a test sheet today.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Start designing
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">Compare plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
