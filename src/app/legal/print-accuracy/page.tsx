import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui/callout";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Print Accuracy Disclaimer",
  description:
    "Screens show RGB light; printers put CMYK ink on material. Why on-screen previews differ from printed labels, and why a 100%-scale test print is mandatory before production.",
};

export default function PrintAccuracyPage() {
  return (
    <ProsePage
      title="Print Accuracy Disclaimer"
      lead="Forge Labels generates exports at exact physical dimensions and previews designs as faithfully as a screen allows. A screen is still not a printer. This page states plainly what can differ, and whose job verification is."
      updated="July 2026"
    >
      <h2>1. Screen color is not printed color</h2>
      <p>
        Your monitor mixes emitted red, green, and blue light; a printer lays
        cyan, magenta, yellow, and black ink (or toner) onto a physical
        material that then reflects ambient light. These are different color
        systems with different reachable ranges: saturated on-screen blues,
        oranges, and neon tones often cannot be reproduced in CMYK, and the
        same exported file will print differently on different printers, inks,
        and stocks. Uncalibrated monitors widen the gap further. Expect
        printed color to be close — never expect it to be identical.
      </p>

      <h2>2. Simulated finishes are approximations</h2>
      <p>
        The holographic, foil, metallic, brushed-metal, transparent, frosted,
        and kraft effects rendered in the editor and the 3D mockup are{" "}
        <strong>visual simulations</strong>. They exist to help you compare
        directions and choose materials, not to promise a physical result.
        Real holographic film, stamped foil, and clear stock interact with
        light, glass, and liquid in ways no screen can reproduce. How the
        physical effects are actually produced is covered in the{" "}
        <Link href="/guides/materials">materials &amp; finishes guide</Link>.
      </p>

      <h2>3. Dimensions must be verified against the physical vial</h2>
      <p>
        Label dimensions are calculated from the measurements you (or a
        preset) provide. Presets are typical manufacturer values, and real
        vials vary — between suppliers, and by roughly ±0.5 mm even within a
        batch. Before relying on any calculated size, measure the actual vial
        you will label and confirm the result as described in the{" "}
        <Link href="/guides/vial-sizes">vial size guide</Link>. A preview
        cannot detect that your vial differs from the numbers it was given.
      </p>

      <h2>4. Always test print at 100% scale</h2>
      <p>
        Before any production run, print <strong>one</strong> label or sheet at
        100% / &quot;actual size&quot; — never &quot;fit to page&quot;, which
        silently rescales output — cut it, and apply it to a real vial. Check
        the fit, the seam position, color under real light, and scan any QR or
        barcode from the printed sample. The{" "}
        <Link href="/guides/printing">printing guide</Link> includes the full
        first-run checklist. A test label costs cents; an unverified run costs
        the whole batch.
      </p>

      <h2>5. Printer variance and calibration</h2>
      <p>
        Desktop printers feed paper with small, machine-specific offsets, and
        color output drifts with ink levels, driver settings, and stock. The
        calibration workflow (print the calibration page, measure the X/Y
        offset, enter the correction) compensates for positional drift on your
        specific printer — but calibration values belong to one printer and
        one stock; recheck after changing either.
      </p>

      <h2>6. Limitation of liability for print outcomes</h2>
      <p>
        Because verification steps exist and are documented, Forge Labels is
        not liable for the costs of print runs produced without them — label
        stock, ink, printing services, application labor, or product delays —
        including where output differs from an on-screen preview, where a
        vial differs from its preset or datasheet, or where a printer&apos;s
        scaling or calibration altered the result. This restates, for print
        outcomes, the limitation of liability in the{" "}
        <Link href="/legal/terms">Terms of Service</Link>. If a discrepancy
        looks like a genuine defect in our export pipeline — a PDF whose
        measured dimensions differ from the project&apos;s specified
        dimensions when printed at 100% — report it to{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>;
        we treat that as a bug, not your problem.
      </p>

      <Callout variant="warning" title="The one-sentence version">
        Measure your actual vial, print one test label at 100% scale, and
        verify it physically before every production run — on-screen colors
        and simulated finishes are guidance, and unverified runs are at your
        own cost.
      </Callout>
    </ProsePage>
  );
}
