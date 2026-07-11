import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ProsePage } from "@/components/marketing/prose-page";
import { VIAL_PRESETS, type CapStyle } from "@/lib/vials/presets";
import { circumference, LABEL_STYLE_LABELS } from "@/lib/geometry/label-calculator";

export const metadata: Metadata = {
  title: "Vial size guide — measuring vials and sizing labels",
  description:
    "How to measure a vial's diameter, straight-wall height, neck, and cap — and turn those numbers into an exact label size. Includes reference dimensions for common 10, 20, and 30 mL vials.",
};

const CAP_LABELS: Record<CapStyle, string> = {
  crimp: "Crimp seal",
  "flip-off": "Flip-off cap",
  screw: "Screw cap",
  dropper: "Dropper cap",
  pump: "Treatment pump",
  none: "No cap",
};

const LABEL_STYLE_GUIDE: { style: keyof typeof LABEL_STYLE_LABELS; when: string }[] = [
  {
    style: "full-wrap",
    when: "The default for vials. Maximum surface, seamless look, and the label reinforces itself around the glass. Choose it when you have one panel of artwork that can flow around the vial, and keep critical content away from the seam.",
  },
  {
    style: "partial-wrap",
    when: "Covers a set fraction of the circumference (60% by default), leaving a deliberate window of exposed glass. Choose it to show off the liquid, or when your printer's sheet can't fit a full wrap.",
  },
  {
    style: "front-only",
    when: "A single panel on the front. Fastest to apply and most forgiving of placement error. Choose it for minimal designs, samples, or when the back must stay clear.",
  },
  {
    style: "front-back",
    when: "Two matching panels: branding on the front, ingredients and warnings on the back. Choose it when required text would crowd a single front panel.",
  },
  {
    style: "neck-band",
    when: "A narrow strip around the neck, sized from the neck diameter (not the body!) with a built-in overlap for tamper evidence. Choose it to seal caps or add a batch stripe.",
  },
  {
    style: "cap-circle",
    when: "A round sticker for the cap top, sized from the cap diameter minus a 1 mm inset. Choose it for top-down identification in drawers, trays, and fridge boxes.",
  },
];

export default function VialSizesGuidePage() {
  const presets = VIAL_PRESETS.filter((p) => !p.isCustom);
  const example = circumference(24.5);

  return (
    <ProsePage
      title="The vial size guide"
      lead="Five minutes with a ruler saves a wasted print run. Here is how to measure any cylindrical vial and turn the numbers into a label that actually fits."
      updated="July 2026"
    >
      <h2>Why &quot;10 mL&quot; tells you almost nothing</h2>
      <p>
        Nominal volume describes what a vial holds, not what it measures. A
        &quot;10 mL&quot; vial can be short and wide (a molded ISO 10R serum
        vial), tall and slim (a tubular crimp-top), or taller still with a
        dropper assembly — three different diameters, three different label
        sizes. Two suppliers&apos; &quot;10 mL serum vials&quot; can differ by a
        millimeter or more in diameter, which changes the wrap width by over
        3 mm. The only numbers a label cares about are the ones you measure.
      </p>

      <h2>How to measure your vial</h2>
      <h3>Diameter</h3>
      <p>
        Use digital calipers if you have them: close the jaws gently on the
        widest part of the body where the label will sit, and read to a tenth
        of a millimeter. No calipers? Use the string method: wrap a strip of
        paper or thread snugly around the body, mark where it overlaps, measure
        the marked length with a ruler — that is the circumference — and divide
        by π (3.1416) to get the diameter. The string method is often
        <em> more</em> reliable for labels, because it measures the true
        circumference including any mold seams.
      </p>
      <h3>Straight-wall height</h3>
      <p>
        Labels only sit flat on the straight, cylindrical part of the wall.
        Measure from where the base curvature ends to where the shoulder
        curvature begins — <strong>stop where the glass starts to curve</strong>.
        A label taller than the straight wall will wrinkle or flag at the
        edges, no matter how carefully you apply it.
      </p>
      <h3>Neck and cap</h3>
      <p>
        If you plan a tamper-evident neck band, measure the neck diameter
        separately — it is usually much smaller than the body. For a cap
        sticker, measure the flat top of the cap. Also note the cap height:
        it affects how the vial reads in the 3D mockup, not the label itself.
      </p>

      <h2>The full-wrap math</h2>
      <p>
        A full-wrap label&apos;s width is the circumference minus a seam gap so
        the ends don&apos;t collide when applied by hand:
      </p>
      <p>
        <strong>width = π × diameter − gap</strong>
      </p>
      <p>
        Worked example — the 10 mL serum vial preset with a measured diameter
        of 24.5 mm and a 3 mm gap: 24.5 × π = {example.toFixed(2)} mm, and{" "}
        {example.toFixed(2)} − 3 = <strong>{(example - 3).toFixed(2)} mm wide</strong>.
        For height, take the 30 mm straight wall and shave 2 mm top and bottom
        for application clearance: <strong>26 mm tall</strong>. So the finished
        label is {(example - 3).toFixed(2)} × 26 mm — and the{" "}
        <Link href="/tools/label-calculator">calculator</Link> adds the 2 mm
        bleed and 3 mm safe zone around it automatically.
      </p>
      <p>
        A 2–4 mm gap is the sweet spot for hand application. Butt seams (0 mm)
        and overlaps demand machine-grade placement or thin film stock.
      </p>

      <h2>Reference dimensions for common vials</h2>
      <p>
        These are the built-in presets — typical manufacturer values for each
        container class, with the full-wrap label size the calculator suggests
        (3 mm seam gap, 4 mm total vertical clearance):
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Preset</th>
              <th>Diameter</th>
              <th>Straight wall</th>
              <th>Suggested full-wrap label (W × H)</th>
              <th>Cap style</th>
            </tr>
          </thead>
          <tbody>
            {presets.map((p) => {
              const width = circumference(p.diameterMm) - 3;
              const height = p.straightWallHeightMm - 4;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.diameterMm.toFixed(2)} mm</td>
                  <td>{p.straightWallHeightMm.toFixed(0)} mm</td>
                  <td>
                    {width.toFixed(1)} × {height.toFixed(0)} mm
                  </td>
                  <td>{CAP_LABELS[p.capStyle]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Every preset is editable — they are starting points, not gospel. Your
        supplier&apos;s drawing (or your calipers) always wins.
      </p>

      <h2>Choosing a label style</h2>
      <ul>
        {LABEL_STYLE_GUIDE.map((item) => (
          <li key={item.style}>
            <strong>{LABEL_STYLE_LABELS[item.style]}.</strong> {item.when}
          </li>
        ))}
      </ul>

      <h2>Tolerances: plan for ±0.5 mm</h2>
      <p>
        Glass vials are made to tolerances, not exact numbers — expect roughly
        ±0.5 mm of manufacturer variance in diameter within a batch, and more
        between suppliers. That is why the default seam gap exists, and why the
        order of operations matters:
      </p>
      <ol>
        <li>
          <strong>Measure</strong> the actual vial from the batch you will
          label (not last year&apos;s sample).
        </li>
        <li>
          <strong>Test print one label</strong> at 100% scale, cut it, and
          apply it to a real vial.
        </li>
        <li>
          <strong>Run the full batch</strong> only after the test label fits.
        </li>
      </ol>
      <p>
        If a batch changes supplier mid-run, re-measure. A 1 mm diameter change
        moves the seam by more than 3 mm.
      </p>

      <Callout variant="warning" title="Always verify against the physical vial">
        Preset dimensions and supplier datasheets are typical values. Before
        printing a full run, measure the exact vial in your hand and apply one
        test label. On-screen accuracy cannot compensate for a vial that
        differs from its spec sheet.
      </Callout>

      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/tools/label-calculator">
            Open the label size calculator
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/guides/printing">Next: the printing guide</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
