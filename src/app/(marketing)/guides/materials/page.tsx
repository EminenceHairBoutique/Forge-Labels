import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Materials & finishes guide — choosing label stock for vials",
  description:
    "Compare label substrates for vials — white and clear PP, metallic PET, kraft, vinyl — plus waterproofing, white ink on clear stock, how real foil and holographic labels are made, and lamination.",
};

const SUBSTRATES = [
  {
    name: "White polypropylene (PP)",
    durability: "Excellent — water- and oil-resistant, tear-proof",
    look: "Clean, opaque white; matte or gloss coatings",
    printers: "Inkjet (PP-coated stock) and laser-rated versions",
    notes: "The default choice for cosmetics and serums.",
  },
  {
    name: "Clear polypropylene (PP)",
    durability: "Excellent — same film as white PP",
    look: "Transparent “no-label” look over glass or liquid",
    printers: "Inkjet-coated or laser-rated versions",
    notes: "Needs a white-ink layer under light artwork (see below).",
  },
  {
    name: "Silver / metallic PET",
    durability: "Excellent — very tear- and moisture-resistant",
    look: "Mirror or brushed metallic; ink picks up the sheen",
    printers: "Mostly inkjet versions; laser only if explicitly rated",
    notes: "The base for at-home metallic and holographic effects.",
  },
  {
    name: "Kraft paper",
    durability: "Low — absorbs water and oil, stains easily",
    look: "Warm, natural, artisanal brown fiber",
    printers: "Inkjet and laser friendly",
    notes: "Beautiful for dry-goods branding; laminate it near liquids.",
  },
  {
    name: "Textured / estate paper",
    durability: "Low to moderate — paper core",
    look: "Premium tactile texture (linen, felt, laid)",
    printers: "Inkjet and laser friendly",
    notes: "Apothecary and premium looks; pair with a varnish or laminate.",
  },
  {
    name: "Waterproof vinyl",
    durability: "Excellent — flexible, conformable, weatherproof",
    look: "White or clear; slightly softer surface than PP",
    printers: "Inkjet versions common; most vinyl is NOT laser-safe",
    notes: "Conforms well to tight curves and small diameters.",
  },
] as const;

export default function MaterialsGuidePage() {
  return (
    <ProsePage
      title="The materials &amp; finishes guide"
      lead="The same artwork looks and lasts completely differently on paper, film, and foil. Here is how the common substrates behave, how premium effects are physically produced, and how to get a label onto glass cleanly."
      updated="July 2026"
    >
      <h2>Substrates at a glance</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Substrate</th>
              <th>Durability</th>
              <th>Look</th>
              <th>Printer compatibility</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {SUBSTRATES.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.durability}</td>
                <td>{s.look}</td>
                <td>{s.printers}</td>
                <td>{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Always match the stock to your printer: an &quot;inkjet&quot; film
        through a laser printer can melt, and laser stock in an inkjet often
        won&apos;t hold ink at all. The <Link href="/guides/printing">printing
        guide</Link> covers handling in detail.
      </p>

      <h2>When you need waterproof and oil-resistant stock</h2>
      <p>
        Vial products live hard lives: facial oils run down the side on first
        use, bathroom shelves are humid, lab vials get wiped with alcohol and
        stored in freezers. If your product is a cosmetic serum, an essential
        or carrier oil, or a lab reagent, treat waterproof, oil-resistant stock
        (PP, PET, or vinyl) as mandatory, not premium. Paper labels — kraft
        included — wick oil within days and turn translucent and blotchy. If
        you love the paper look for an oil product, use a laminated paper stock
        or a textured film that imitates it. And remember the ink matters too:
        pigment inkjet or laser toner on waterproof stock survives; dye ink on
        the same stock can still smear.
      </p>

      <h2>Transparent labels and the white-ink problem</h2>
      <p>
        Clear stock creates the premium &quot;printed on the glass&quot; look —
        but there is a catch. Desktop printers have no white ink: they only lay
        down cyan, magenta, yellow, and black, and every color relies on the
        white of the material to be visible. On clear film there is no white,
        so white artwork simply doesn&apos;t print — it stays transparent — and
        light colors become faint, glassy tints, especially over amber or
        cobalt glass or a dark liquid.
      </p>
      <p>
        Commercial presses solve this with a <strong>white-ink underlayer</strong>:
        an opaque white shape printed first, exactly under the artwork that
        needs to pop, with CMYK on top. If you order clear labels
        commercially, ask for white ink behind your logo and text. On the
        Business plan, Forge Labels can export that white layer as a separate{" "}
        <em>production layer</em> alongside your artwork, in the form presses
        expect. Designing for clear stock at home? Use dark, saturated artwork
        and treat the glass and liquid as part of the design.
      </p>

      <h2>How holographic and foil labels are really made</h2>
      <p>There are two physical routes to the shiny stuff:</p>
      <ul>
        <li>
          <strong>Effect stock + your printer.</strong> Buy label sheets that
          are already holographic or metallic (a PET film with the effect
          embossed or metallized in), then print your artwork on top. The CMY
          inks act like translucent glazes, so the rainbow or mirror effect
          shines through lighter areas, while solid dark ink masks it. Design
          rule: leave the areas you want to sparkle unprinted or lightly
          printed.
        </li>
        <li>
          <strong>Commercial spot foil / UV.</strong> A press applies real
          metallic foil (hot or cold stamping) or raised UV varnish only where
          a separate artwork layer says to. This gives crisp metallic type on
          an otherwise matte label — the classic premium-cosmetic look. It
          requires supplying that layer as its own file, which is exactly what
          Business-plan production layers export.
        </li>
      </ul>

      <h2>Lamination</h2>
      <p>
        A laminate is a clear film applied over the printed label. It adds
        real durability — scuff, moisture, and smear protection — and sets the
        surface feel: <strong>gloss</strong> for vivid, wet-look color;{" "}
        <strong>matte</strong> for a muted, modern finish that hides
        fingerprints; <strong>soft-touch</strong> for the velvety feel of
        high-end skincare. At home, laminating overlays for label sheets exist
        but demand careful alignment; commercially, lamination is a checkbox
        and worth it for any label that gets handled oily-fingered.
      </p>

      <Callout variant="info" title="On-screen finishes are simulations">
        The holographic, foil, metallic, and transparent effects you see in the
        Forge Labels editor and 3D mockup are visual simulations, rendered to
        help you choose materials and plan artwork. They are not a promise of
        printed output: the physical result depends on the stock, the printing
        process, and your printer. Preview on screen, decide, then verify with
        a printed sample of the real material. See the{" "}
        <Link href="/legal/print-accuracy">Print Accuracy Disclaimer</Link>.
      </Callout>

      <h2>Applying labels to glass, cleanly</h2>
      <ul>
        <li>
          <strong>Clean the glass first.</strong> Wipe the vial with isopropyl
          alcohol and let it flash off. Mold-release residue and fingerprints
          are why labels lift at the seam a week later.
        </li>
        <li>
          <strong>Work at room temperature.</strong> Cold glass condenses
          moisture under the label; adhesives bond poorly below ~15 °C.
        </li>
        <li>
          <strong>Wrap, don&apos;t plant.</strong> Rest the vial on its side or
          in a V-groove (two pencils taped to the bench work). Tack down the
          leading edge of the label square to the vial&apos;s axis, then roll
          the vial across the label so it lays itself down. Placing the middle
          first guarantees a spiral.
        </li>
        <li>
          <strong>Never stretch the label.</strong> Film stocks stretch a
          little and then creep back over hours, opening the seam. Guide it
          on with zero tension and smooth outward from the leading edge.
        </li>
        <li>
          <strong>Press the seam last</strong> with a firm thumb-stroke, and
          give the adhesive 24 hours to reach full bond before boxing.
        </li>
      </ul>

      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard">
            Preview finishes on your label
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/guides/vial-sizes">Back to: vial sizes</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
