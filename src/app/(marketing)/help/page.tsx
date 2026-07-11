import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  Palette,
  PenTool,
  Printer,
  Rocket,
  Ruler,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Help center",
  description:
    "Answers to common Forge Labels questions: starting a project, editor shortcuts and autosave, label sizing, printing and export, templates and brand kits, and account & billing.",
};

interface HelpFaq {
  q: string;
  a: React.ReactNode;
}

interface HelpTopic {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  faqs: HelpFaq[];
}

const TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "Getting started",
    description: "Your first project, from vial preset to first design.",
    faqs: [
      {
        q: "How do I start my first project?",
        a: (
          <>
            Open the <Link href="/dashboard">dashboard</Link> and create a new
            project. Pick a vial preset (or enter custom measurements), choose
            a label style, and either start from a template or a blank canvas.
            The editor opens with a canvas that matches your label&apos;s exact
            physical dimensions, including bleed and safe-zone guides.
          </>
        ),
      },
      {
        q: "Do I need an account to try Forge Labels?",
        a: (
          <>
            No — the editor and the{" "}
            <Link href="/tools/label-calculator">size calculator</Link> are
            free to open without signing up. You need an account to save
            projects to the cloud, keep version history, and subscribe to a
            paid plan. In local demo mode (no cloud configured), projects are
            saved in your browser instead.
          </>
        ),
      },
      {
        q: "Which vial preset should I pick?",
        a: (
          <>
            Match the container type first — serum vial, crimp-top, dropper
            bottle, pump bottle — then verify the dimensions against your
            actual vial with calipers or the string method. Every preset is
            editable. The <Link href="/guides/vial-sizes">vial size guide</Link>{" "}
            walks through measuring in detail.
          </>
        ),
      },
      {
        q: "Can I start from a template?",
        a: "Yes. The template library covers common vial products — serums, oils, tinctures, lab labels — and every template adapts to your label dimensions when applied. Replace the placeholder text, swap colors, drop in your logo, and it is yours.",
      },
      {
        q: "What does the Free plan include?",
        a: (
          <>
            The full design editor, all vial presets and the calculator,
            starter templates, QR and barcode generators, PNG export at 300
            DPI, the print-sheet generator, and 3 saved projects. See{" "}
            <Link href="/pricing">pricing</Link> for what Pro and Business add.
          </>
        ),
      },
      {
        q: "Is Forge Labels only for vials?",
        a: "It is optimized for 10–30 mL cylindrical vials and bottles, but the custom preset accepts any diameter and wall height, so any cylindrical container — tubes, jars with straight walls, larger bottles — can be sized the same way.",
      },
    ],
  },
  {
    id: "editor",
    icon: PenTool,
    title: "The editor",
    description: "Tools, shortcuts, autosave, fonts, and layers.",
    faqs: [
      {
        q: "What are the essential keyboard shortcuts?",
        a: (
          <>
            Undo is <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Z</kbd> and redo is{" "}
            <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>.
            Standard shortcuts also cover duplicating objects, nudging with the
            arrow keys (with a larger step while holding Shift), deleting, and
            zooming. Everything destructive is undoable, so experiment freely.
          </>
        ),
      },
      {
        q: "How does autosave work?",
        a: "Projects save automatically as you edit — there is no save button to forget. With an account in cloud mode, changes are saved to your account. In local demo mode, projects are stored in your browser's local storage: they persist on that device and browser, but clearing site data will remove them, so export anything you care about.",
      },
      {
        q: "How do I make curved text?",
        a: "Select a text object and enable the curve option in its properties, then adjust the radius and direction to arc the text upward or downward. It is the classic treatment for text following the cap edge or a circular seal.",
      },
      {
        q: "How do layers, locking, and grouping work?",
        a: "The layers panel lists every object in stacking order. Drag to reorder, click the lock to make a finished element unselectable (backgrounds especially), toggle visibility, and group related objects so they move and scale as one.",
      },
      {
        q: "Can I use my own fonts?",
        a: (
          <>
            Yes — upload font files in the editor and they become available for
            text objects and brand kits. One important note: you must hold a
            license for any font you upload that permits embedding in print
            artwork and, if applicable, commercial use. The fonts bundled with
            Forge Labels are licensed under the SIL Open Font License. See the{" "}
            <Link href="/legal/ip-policy">IP &amp; Content Policy</Link>.
          </>
        ),
      },
      {
        q: "Why do objects snap while I drag them?",
        a: "Smart guides snap objects to the canvas center, edges, safe zone, and to other objects' edges and centers — which is what you want on a label a few centimeters wide. For free placement, you can temporarily override snapping while dragging, or position objects numerically in the properties panel.",
      },
      {
        q: "What image formats can I place?",
        a: "PNG, JPEG, and SVG uploads all work. Use SVG for logos whenever you have it — it stays sharp at any export size. For raster images, preflight warns you if the effective resolution falls below print quality at the printed size.",
      },
    ],
  },
  {
    id: "sizing",
    icon: Ruler,
    title: "Sizing & calculator",
    description: "Measurements, label styles, and canvas dimensions.",
    faqs: [
      {
        q: "How do I find the right label size for my vial?",
        a: (
          <>
            Measure the vial&apos;s diameter and straight-wall height, then let
            the <Link href="/tools/label-calculator">calculator</Link> derive
            the label dimensions — for a full wrap, width is circumference
            (diameter × π) minus the seam gap. The{" "}
            <Link href="/guides/vial-sizes">vial size guide</Link> shows how to
            measure with calipers or a strip of paper.
          </>
        ),
      },
      {
        q: "What happens if I change the vial size mid-project?",
        a: "The canvas recalculates to the new label dimensions immediately. Your objects keep their physical size and position, so a change in width or height can move content relative to the edges — review the layout and the safe zone afterwards, especially anything near the seam.",
      },
      {
        q: "What are bleed and safe zones?",
        a: (
          <>
            Bleed (2 mm by default) extends backgrounds past the cut line so
            slight cutting drift never leaves a white edge; the safe zone (3 mm
            by default) keeps text and codes away from the cut line so they are
            never clipped. Both are drawn on the canvas and explained in the{" "}
            <Link href="/guides/printing">printing guide</Link>.
          </>
        ),
      },
      {
        q: "What seam gap should I use for a full wrap?",
        a: "2–4 mm is comfortable for hand application; the default is 3 mm. Smaller gaps look better but demand precise placement; 0 mm (butt seam) or overlap is realistic only with machine application or thin film stock.",
      },
      {
        q: "Why is the suggested label shorter than my vial's wall?",
        a: "The calculator shaves 2 mm from the top and bottom of the straight wall by default. Applying a label flush to where the glass starts curving invites lifted edges — the clearance is deliberate, and you can adjust it.",
      },
      {
        q: "Can I make neck bands and cap stickers?",
        a: "Yes. Label styles include tamper-evident neck bands (sized from the neck diameter, with a built-in overlap) and round cap stickers (sized from the cap diameter with a small inset), alongside full wrap, partial wrap, front-only, and front & back panels.",
      },
    ],
  },
  {
    id: "printing",
    icon: Printer,
    title: "Printing & export",
    description: "PDF, PNG, SVG, sheets, calibration, and scannability.",
    faqs: [
      {
        q: "How do I export a print-ready PDF with bleed?",
        a: (
          <>
            Run preflight, then choose PDF in the export dialog — the file is
            generated at exact physical size with the 2 mm bleed and crop
            marks, which is what commercial printers expect. Print-ready PDF
            export is part of the Pro plan; the Free plan exports PNG at 300
            DPI. See <Link href="/pricing">pricing</Link> for the full matrix.
          </>
        ),
      },
      {
        q: "Which export format should I choose?",
        a: "Imposed PNG or PDF sheets for home printing on Letter/A4 label stock; single-label print-ready PDF for commercial printers and roll printers; SVG when a workflow needs editable vectors — cutting plotters, downstream design tools, or a printer that asks for vector art.",
      },
      {
        q: "My printed label is the wrong size. What happened?",
        a: (
          <>
            Almost always the printer dialog scaled the page — print at 100% /
            &quot;actual size&quot;, never &quot;fit to page&quot;. If the size
            is right but placement drifts, run the calibration workflow. If the
            label genuinely doesn&apos;t match the vial, re-measure the vial —
            see the <Link href="/guides/vial-sizes">vial size guide</Link>.
          </>
        ),
      },
      {
        q: "Why won't my QR code scan?",
        a: "The usual causes, in order: printed too small for the amount of data (shorten the URL or enlarge the code), low contrast between code and background, a light code on a dark background (many scanners expect dark-on-light), a violated quiet zone (keep the margin around the code clear), or ink bleed on uncoated stock. Preflight flags the first four before export — and always test-scan a printed sample, not the screen.",
      },
      {
        q: "How does printer calibration work?",
        a: (
          <>
            Print the calibration page at 100%, measure how far the printed
            marks are offset from their target positions in X and Y, enter
            those corrections in the print settings, and reprint to confirm.
            The offset is consistent per printer, so you only do this once.
            Full walkthrough in the{" "}
            <Link href="/guides/printing">printing guide</Link>.
          </>
        ),
      },
      {
        q: "Can I lay out many labels on one sheet?",
        a: "Yes — the print-sheet generator imposes your label repeatedly on US Letter, A4, or a custom sheet size, with configurable margins and spacing plus crop marks for cutting.",
      },
      {
        q: "When should I export at 600 DPI instead of 300?",
        a: "300 DPI is right for nearly everything. Step up to 600 DPI when the label carries very small type (under about 5 pt), dense barcodes, or fine line detail — small labels concentrate a lot of detail per millimeter. 600 DPI export is included in Pro and above.",
      },
    ],
  },
  {
    id: "templates",
    icon: Palette,
    title: "Templates & brand kits",
    description: "Using templates, commercial rights, and brand assets.",
    faqs: [
      {
        q: "How do I use a template?",
        a: "Apply one when creating a project (or from the template browser) and it adapts to your label's dimensions. Everything in it is a normal editable object — replace the placeholder text, recolor, swap imagery, and delete what you don't need.",
      },
      {
        q: "Can I sell products that use a template?",
        a: (
          <>
            On plans that include commercial template use (Pro and above), yes
            — templates may be used in labels for products you sell. What no
            plan allows is redistributing or reselling the templates themselves
            as templates. Details in the{" "}
            <Link href="/legal/ip-policy">IP &amp; Content Policy</Link>.
          </>
        ),
      },
      {
        q: "What is a brand kit?",
        a: "A saved set of brand assets — logos, color palette, fonts, and standard text blocks like warnings and company lines — that you can apply to any project. It is how a ten-product line stays consistent. Brand kits are included in Pro and above.",
      },
      {
        q: "How do I apply my brand kit to a project?",
        a: "Select the brand kit in the editor and its palette, fonts, and assets become the project's defaults — new text uses your fonts, the color picker leads with your palette, and saved logos and text blocks are one click away.",
      },
      {
        q: "Can my team share templates and brand assets?",
        a: (
          <>
            On the Business plan, up to five team members share brand kits and
            projects, so everyone designs from the same assets. See{" "}
            <Link href="/pricing">pricing</Link>.
          </>
        ),
      },
      {
        q: "Can I save my own design as a reusable template?",
        a: "Yes — duplicate a finished project as the starting point for the next product, and keep shared elements (background, brand band, warning block) grouped so they carry over cleanly.",
      },
    ],
  },
  {
    id: "account",
    icon: CreditCard,
    title: "Account & billing",
    description: "Subscriptions, invoices, data export, and deletion.",
    faqs: [
      {
        q: "How do I upgrade, downgrade, or cancel my subscription?",
        a: (
          <>
            From your account&apos;s billing settings, which open the Stripe
            customer portal. Upgrades apply immediately with prorated billing;
            downgrades and cancellations take effect at the end of the period
            you have paid for. The full rules are in the{" "}
            <Link href="/legal/subscription-policy">Subscription Policy</Link>.
          </>
        ),
      },
      {
        q: "How do I update my payment method or download invoices?",
        a: "In the Stripe customer portal, linked from billing settings. Payments are processed entirely by Stripe — Forge Labels never stores your card number.",
      },
      {
        q: "What happens to my projects if I downgrade?",
        a: "Projects over your new plan's limit become read-only — never deleted. You can still open and view them, and they become editable again if you upgrade or remove other projects to get under the limit.",
      },
      {
        q: "How do I export my data?",
        a: (
          <>
            You can export your designs (PDF/PNG/SVG per your plan) at any
            time, and request an export of your account data — projects and
            uploaded assets — as described in the{" "}
            <Link href="/legal/privacy">Privacy Policy</Link>. In local demo
            mode your data never leaves the browser, so exporting files is the
            backup.
          </>
        ),
      },
      {
        q: "How do I delete my account?",
        a: (
          <>
            Request deletion from account settings or by emailing{" "}
            <a href="mailto:hello@forgelabels.example">
              hello@forgelabels.example
            </a>{" "}
            from your account address. Your projects, uploads, and personal
            data are deleted on the schedule described in the{" "}
            <Link href="/legal/privacy">Privacy Policy</Link>. Export anything
            you want to keep first — deletion is permanent.
          </>
        ),
      },
      {
        q: "What is local demo mode?",
        a: "When Forge Labels runs without cloud services (Supabase and Stripe) configured, it operates in local demo mode: no accounts, no billing, and all features available for evaluation, with projects stored in your browser. When the workspace is configured for cloud mode, accounts, subscriptions, and cloud storage activate.",
      },
      {
        q: "Is my payment information safe?",
        a: "Card details are entered on and processed by Stripe, a PCI-DSS Level 1 payment processor. They are never transmitted to or stored on Forge Labels servers — we only receive confirmation of the subscription state.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Intro */}
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Help center
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Practical answers for designing, sizing, and printing vial labels
          with Forge Labels. Pick a topic, or skim the questions below.
        </p>
      </div>

      {/* Topic cards */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic) => (
          <Card key={topic.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                  <topic.icon className="size-5" aria-hidden />
                </div>
                <CardTitle>
                  <Link href={`#${topic.id}`} className="hover:text-primary">
                    {topic.title}
                  </Link>
                </CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">{topic.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {topic.faqs.slice(0, 4).map((faq, i) => (
                  <li key={faq.q}>
                    <Link
                      href={`#${topic.id}-q${i + 1}`}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {faq.q}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Topic sections */}
      <div className="mx-auto mt-16 max-w-3xl space-y-14">
        {TOPICS.map((topic) => (
          <section key={topic.id} id={topic.id} className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                <topic.icon className="size-4.5" aria-hidden />
              </div>
              <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                {topic.title}
              </h2>
            </div>
            <Accordion type="single" collapsible className="mt-4">
              {topic.faqs.map((faq, i) => (
                <AccordionItem
                  key={faq.q}
                  value={faq.q}
                  id={`${topic.id}-q${i + 1}`}
                  className="scroll-mt-24"
                >
                  <AccordionTrigger>{faq.q}</AccordionTrigger>
                  <AccordionContent>
                    <div className="[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_kbd]:rounded [&_kbd]:border [&_kbd]:border-border [&_kbd]:bg-subtle [&_kbd]:px-1 [&_kbd]:py-0.5 [&_kbd]:font-mono [&_kbd]:text-[11px]">
                      {faq.a}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>

      <Callout variant="info" title="Still stuck?" className="mx-auto mt-16 max-w-3xl">
        Email{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>{" "}
        with your question — include your vial measurements and a screenshot if
        it is a sizing or printing issue, and we can usually spot the problem
        quickly. Business-plan subscribers receive priority responses.
      </Callout>
    </div>
  );
}
