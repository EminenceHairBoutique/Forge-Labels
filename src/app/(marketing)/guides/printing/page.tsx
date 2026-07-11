import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Printing guide — from export to a label on the vial",
  description:
    "Home inkjet vs laser, roll printers, and commercial printing for vial labels. Bleed, trim, and safe zones explained, plus DPI, crop marks, printer calibration, and a first-print checklist.",
};

export default function PrintingGuidePage() {
  return (
    <ProsePage
      title="The printing guide"
      lead="A perfect design can still print badly. This guide covers choosing a printing route, understanding bleed and DPI, calibrating your printer, and running your first sheet without wasting label stock."
      updated="July 2026"
    >
      <h2>Choosing a printing route</h2>
      <h3>Home inkjet on sheet labels</h3>
      <p>
        The most common starting point: A4 or US Letter sheets of adhesive
        label stock through an ordinary inkjet. Inkjets produce rich color and
        handle glossy and specialty coatings well, but standard dye inks are
        water-soluble — smudged labels on an oil dropper are a real risk.
        Prefer pigment inks, use stock made for inkjet, and let prints dry
        fully before cutting (see handling tips below). Use the print-sheet
        generator to impose your label repeatedly on the sheet with crop marks.
      </p>
      <h3>Home or office laser on sheet labels</h3>
      <p>
        Laser toner is fused with heat, so output is dry immediately and far
        more water-resistant than dye inkjet. The trade-offs: slightly less
        vivid color on some stocks, and the fuser&apos;s heat rules out
        heat-sensitive materials — never feed vinyl or foil-effect stock not
        rated for laser through a laser printer. Buy stock explicitly marked
        laser-compatible.
      </p>
      <h3>Roll-label and thermal printers</h3>
      <p>
        Dedicated roll printers (inkjet-roll or thermal-transfer) print onto
        continuous label rolls and are the step up for regular small batches.
        For these, export single-label PDFs at exact size rather than imposed
        sheets, and set the roll width to your label height or width depending
        on orientation. Direct-thermal stock is monochrome and fades with heat
        and light — fine for lab IDs and lot labels, wrong for retail-facing
        cosmetics.
      </p>
      <h3>Commercial printing</h3>
      <p>
        For production quantities, premium materials, or true foil, send a
        commercial printer the print-ready PDF export: exact trim size, 2 mm
        bleed, and crop marks — the file they expect. Ask for their preferred
        specs first; some shops want extra bleed or their own imposition.
      </p>

      <h2>Bleed, trim, and safe zones — and why they exist</h2>
      <p>
        No printing-and-cutting system is perfectly aligned; everything drifts
        by fractions of a millimeter. Three zones absorb that drift:
      </p>
      <ul>
        <li>
          <strong>Trim</strong> is the finished label size — the line the cut
          is supposed to follow.
        </li>
        <li>
          <strong>Bleed</strong> (2 mm default) extends backgrounds and images
          past the trim, so a cut that lands slightly outside the line still
          shows ink, not a white sliver.
        </li>
        <li>
          <strong>Safe zone</strong> (3 mm default) insets from the trim; keep
          text, logos, and codes inside it, so a cut that lands slightly inside
          the line doesn&apos;t clip your content.
        </li>
      </ul>
      <p>
        The editor draws all three on every canvas, and preflight flags content
        that violates them. If your artwork has a background color or image, it
        must reach the bleed edge — never stop it at the trim line.
      </p>

      <h2>Crop and registration marks</h2>
      <p>
        Crop marks are thin lines outside each label&apos;s corners showing
        exactly where to cut; because they sit outside the bleed, they never
        appear on the finished label. Sheet exports can also include
        registration marks — sheet-level targets used to check that the print
        landed square and centered, and to line up guillotine cuts across a
        stack. If you cut by hand with a craft knife and straightedge, crop
        marks are the difference between labels that look die-cut and labels
        that look scissored.
      </p>

      <h2>DPI, explained in one paragraph</h2>
      <p>
        DPI (dots per inch) is how much detail a raster export carries. 300
        DPI is the print-industry standard and is correct for nearly all vial
        labels. Choose 600 DPI when the label carries very small text (under
        ~5 pt), fine line work, or dense barcodes — on a label only 26 mm
        tall, detail is proportionally huge. Vector exports (PDF, SVG) have no
        DPI for text, shapes, and codes; only placed images have an effective
        resolution, which preflight checks for you.
      </p>

      <h2>Calibrating your printer</h2>
      <p>
        Most desktop printers feed paper with a small, consistent offset —
        labels print a millimeter left or a millimeter low, every time. Because
        it is consistent, you can cancel it once:
      </p>
      <ol>
        <li>
          <strong>Print the calibration page</strong> from the print-sheet
          generator at 100% scale.
        </li>
        <li>
          <strong>Measure the offset</strong>: the page has rulers along both
          axes — read how far the printed marks sit from the paper edges versus
          the printed target values, in X and Y.
        </li>
        <li>
          <strong>Enter the X/Y correction</strong> in the print settings; the
          imposition shifts by exactly that amount.
        </li>
        <li>
          <strong>Reprint</strong> the calibration page to confirm, then print
          your label sheet. The correction is remembered per printer.
        </li>
      </ol>

      <h2>Paper and material handling</h2>
      <ul>
        <li>
          <strong>Let inkjet prints dry</strong> — 10 to 15 minutes for coated
          stock, longer for glossy — before cutting, stacking, or applying.
          Wet ink smears under a straightedge.
        </li>
        <li>
          <strong>Respect the laser fuser.</strong> Laser printers run hot
          enough to melt adhesives and warp films. Only feed stock rated for
          laser use, and never re-feed a sheet that has already been through
          once with labels partially removed — a peeled label inside the fuser
          is a repair bill.
        </li>
        <li>
          <strong>Foil-effect and holographic stocks</strong> are usually
          inkjet-only or require special toner-safe versions — check the
          manufacturer&apos;s rating, and see the{" "}
          <Link href="/guides/materials">materials guide</Link> for how these
          stocks behave.
        </li>
        <li>
          <strong>Store stock flat and dry.</strong> Humidity curls sheets, and
          curled sheets jam and misregister.
        </li>
        <li>
          <strong>Use the straightest paper path</strong> your printer offers
          (rear feed or single-sheet tray) for thick label stock.
        </li>
      </ul>

      <h2>Your first print run, step by step</h2>
      <ol>
        <li>
          Measure your vial and confirm the label size in the{" "}
          <Link href="/tools/label-calculator">calculator</Link> (see the{" "}
          <Link href="/guides/vial-sizes">vial size guide</Link>).
        </li>
        <li>Finish the design and run the preflight check — fix every error.</li>
        <li>Pick your sheet size (Letter/A4/custom) and generate the imposed sheet with crop marks.</li>
        <li>Print the calibration page, measure, and enter your X/Y correction.</li>
        <li>
          Print <strong>one</strong> sheet on plain paper at 100% scale. Hold
          it against the vial; check size, seam position, and readability.
        </li>
        <li>Print one sheet on the real label stock. Cut one label, apply it, and check scannability of any codes.</li>
        <li>Only now, print the full run — same printer, same settings, same stock.</li>
      </ol>

      <Callout variant="warning" title="Print at 100% — never &quot;fit to page&quot;">
        Every export is generated at exact physical size. In your printer
        dialog, set scale to 100% / &quot;actual size&quot; and disable
        &quot;fit to page&quot;, &quot;shrink to printable area&quot;, and any
        automatic scaling. Fit-to-page silently rescales the sheet by a few
        percent — enough to make every label on it the wrong size.
      </Callout>

      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard">
            Design a label to print
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/guides/materials">Next: materials &amp; finishes</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
