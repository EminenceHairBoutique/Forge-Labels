import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui/callout";
import { ProsePage } from "@/components/marketing/prose-page";
import { COMPLIANCE_NOTICE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Regulatory Disclaimer",
  description:
    "Forge Labels is a design tool, not a compliance service: it does not certify FDA, FTC, pharmaceutical, cosmetic, supplement, laboratory, or medical labeling requirements.",
};

export default function RegulatoryPage() {
  return (
    <ProsePage
      title="Regulatory Disclaimer"
      lead="Vials hold regulated things — cosmetics, supplements, medicines, lab reagents. Forge Labels helps you design their labels; it does not, and cannot, make those labels legally compliant. This page spells out the division of responsibility."
      updated="July 2026"
    >
      <h2>1. What Forge Labels is — and is not</h2>
      <p>
        Forge Labels is design software: it computes label geometry, provides
        an editor and templates, and produces print-oriented exports. It is{" "}
        <strong>not</strong> a regulatory-compliance service, and nothing in
        the product — templates, preflight checks, example text, warnings
        blocks in brand kits, or documentation — is legal or regulatory
        advice. The platform does not review your label content and does not
        certify or warrant compliance with the requirements of the FDA, FTC,
        EMA, Health Canada, or any other regulator, pharmacopeia, or standard
        — across pharmaceutical, cosmetic, supplement, food, laboratory,
        medical-device, or any other product category.
      </p>

      <h2>2. What you must verify</h2>
      <p>
        If your product is sold, distributed, or used by others, labeling law
        almost certainly applies to it. Before printing, you — with qualified
        regulatory or legal advice where appropriate — must verify for your
        specific product and every jurisdiction where it will be sold:
      </p>
      <ul>
        <li>
          <strong>Mandatory warnings and statements</strong> — safety warnings,
          usage directions, storage conditions, age restrictions, and any
          category-specific mandatory phrases.
        </li>
        <li>
          <strong>Ingredient declarations</strong> — complete and correctly
          ordered ingredient lists (for example INCI naming for cosmetics),
          allergen disclosures, and active-ingredient declarations.
        </li>
        <li>
          <strong>Identifiers and particulars</strong> — product identity, net
          contents in the required units, lot/batch numbers, expiry or
          period-after-opening marks, barcodes/registration numbers where
          required, and the name and address of the responsible party.
        </li>
        <li>
          <strong>Claims and disclosures</strong> — that every marketing claim
          (&quot;clinically proven&quot;, &quot;organic&quot;,
          &quot;sterile&quot;, health or structure/function claims) is
          substantiated, permitted for your category, and carries any required
          qualifier.
        </li>
        <li>
          <strong>Format requirements</strong> — minimum type sizes, required
          panels and placement, language requirements, and legibility rules
          that some categories impose.
        </li>
      </ul>

      <h2>3. Templates and presets are starting points</h2>
      <p>
        Template text, placeholder warnings, and preset layouts demonstrate
        design, not compliance. A template that leaves no room for your
        jurisdiction&apos;s mandatory content is the wrong template for your
        product, however good it looks. Preflight checks catch print problems
        (resolution, safe zones, scannability) — they do not and cannot check
        legal sufficiency of content.
      </p>

      <h2>4. Counterfeit and deceptive labels are prohibited</h2>
      <p>
        Using the service to create counterfeit labels, imitate another
        brand&apos;s product, falsify lot numbers or expiry dates, or
        misrepresent a product&apos;s identity, contents, or certifications is
        prohibited and enforced under the{" "}
        <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>. This
        includes fake regulatory marks and certification seals.
      </p>

      <h2>5. The platform-wide notice</h2>
      <p>
        The following notice appears across the platform and applies to every
        label designed with it:
      </p>
      <Callout variant="warning" title="Compliance notice">
        {COMPLIANCE_NOTICE}
      </Callout>

      <h2>6. Allocation of responsibility</h2>
      <p>
        By exporting a label you confirm that you are the party responsible
        for its content and legality. Forge Labels is not liable for
        regulatory action, recalls, fines, or losses arising from label
        content, as set out in the{" "}
        <Link href="/legal/terms">Terms of Service</Link>. For dimensional and
        color accuracy — a separate topic — see the{" "}
        <Link href="/legal/print-accuracy">Print Accuracy Disclaimer</Link>.
      </p>

      <h2>7. Questions</h2>
      <p>
        We cannot provide regulatory advice, but if anything on this page is
        unclear, contact{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>.
        For advice on your product&apos;s labeling obligations, consult a
        regulatory-affairs professional in your market.
      </p>
    </ProsePage>
  );
}
