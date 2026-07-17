import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui/callout";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Research label guide — lot, batch, notices, and verification",
  description:
    "How to organize lot and batch information, place research-use notices, size a COA QR code, choose information density, and keep label artwork separate from verified scientific data.",
};

export default function ResearchLabelsGuide() {
  return (
    <ProsePage
      title="Research label guide"
      lead="Working conventions for laboratory, biotechnology, and research-compound labels — what belongs on the vial, where it goes, and what a label can and cannot claim."
    >
      <h2 id="lot-batch">Organizing lot and batch information</h2>
      <p>
        Lot and batch identifiers are the most-read lines on a working label —
        treat them as first-class content, not fine print. Three habits keep
        them useful: pick ONE format and never vary it
        (<code>LOT&nbsp;2401-A</code>, <code>BATCH&nbsp;24-118</code>), keep
        the prefix so a number is meaningful out of context, and place them in
        the same position on every product so a shelf scans vertically.
        Forge&nbsp;Labels&apos; research templates reserve a technical block
        for exactly this, set in a monospaced face so digits align.
      </p>

      <h2 id="catalog">Catalog-number systems</h2>
      <p>
        A catalog number identifies the <em>product</em>; a lot identifies the
        <em> production run</em>; a batch ties to your internal records. Keep
        the three visually distinct, and put the catalog number where
        reordering customers expect it — near the product name or at the top
        of the technical panel. Short, structured schemes
        (<code>CAT-2101</code>) outlive clever ones.
      </p>

      <h2 id="notices">Research-use notice placement</h2>
      <p>
        A research-use notice should be impossible to miss without shouting:
        uppercase, letter-spaced, full line, never wrapped into a corner. The
        Easy Creator keeps notices visible by design — when space runs out,
        nearly every other optional field steps aside before the notice does,
        and you review the exact wording before every export.
      </p>
      <Callout variant="warning" title="A notice is not a shield">
        A research-use notice does not by itself determine or legally
        establish a product&apos;s intended use. Product descriptions,
        marketing, instructions, imagery, and surrounding claims must also
        remain consistent with the actual lawful use of the product. When in
        doubt, ask a qualified professional — this guide isn&apos;t legal
        advice.
      </Callout>

      <h2 id="coa-qr">COA and verification QR codes</h2>
      <p>
        The strongest trust signal a small label can carry is a pointer to a
        document: a QR code that resolves to the batch&apos;s certificate of
        analysis or a verification page you host. Three rules: the code needs
        roughly 9&nbsp;mm and clear space around it to scan reliably (the
        editor enforces both), the destination should name the same catalog
        and lot numbers printed beside it, and the URL should be one you
        control. Pair the code with a short printed verification code for
        people who can&apos;t scan.
      </p>

      <h2 id="density">How much information fits</h2>
      <p>
        A 10&nbsp;mL vial wrap is about 71&nbsp;×&nbsp;26&nbsp;mm — the same
        area as two postage stamps. Essential content (brand, compound,
        amount, notice, lot) reads comfortably; the full science block
        (formula, weight, CAS, sequence, purity) fits only with deliberate
        layout. Use the editor&apos;s Essential&nbsp;/ Standard&nbsp;/
        Detailed modes rather than shrinking type by hand — the layout
        engine holds minimum print sizes and tells you honestly when
        something can&apos;t fit.
      </p>

      <h2 id="families">Designing a product family</h2>
      <p>
        Families read as families when only one thing changes. Keep the grid,
        typography, material, and notice identical; vary the accent color and
        the product fields. Conventional amount coding (5&nbsp;mg blue,
        10&nbsp;mg purple, 20&nbsp;mg red, 30&nbsp;mg gold) is built into the
        matching-series generator, and a CSV import turns a product list into
        finished labels in one pass.
      </p>

      <h2 id="artwork-vs-data">Artwork is not verified data</h2>
      <p>
        A label is a design artifact. Printing a purity percentage, a CAS
        number, or a molecular weight doesn&apos;t make it true — those
        values must come from your own documentation, and the responsibility
        for them stays with you. Forge&nbsp;Labels never suggests scientific
        values, flags wording that could imply medical use or approvals, and
        records what you reviewed before export. What it cannot do is verify
        your chemistry.
      </p>

      <h2 id="claims">Avoiding unsupported claims</h2>
      <p>
        Words like <em>treats</em>, <em>cures</em>, <em>prevents</em>, dosage
        directions, or an FDA reference change what a label legally is in
        most jurisdictions. If your product is sold for research, everything
        on the label — and around it — should say so consistently. The export
        review lists wording worth a second look; it never rewrites or
        removes anything.
      </p>

      <p>
        Ready to put this to work?{" "}
        <Link href="/create?industry=research-peptide">
          Start a research label
        </Link>{" "}
        — the wizard asks for your compound, amounts, lot and batch, and
        notice, then recommends layouts designed to carry them.
      </p>
    </ProsePage>
  );
}
