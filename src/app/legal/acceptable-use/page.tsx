import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description:
    "What may not be created or done with Forge Labels: counterfeit and deceptive labels, IP infringement, falsified mandatory information, unlawful products, and service abuse.",
};

export default function AcceptableUsePage() {
  return (
    <ProsePage
      title="Acceptable Use Policy"
      lead="Forge Labels exists to help people label their own products well. This policy draws the lines: what the service must never be used to create or do."
      updated="July 2026"
    >
      <h2>1. Scope</h2>
      <p>
        This policy applies to everything you create, upload, export, or do
        with Forge Labels and is part of the{" "}
        <Link href="/legal/terms">Terms of Service</Link>. You remain
        responsible for your labels after export — including how they are
        printed and what products they are applied to.
      </p>

      <h2>2. Prohibited labels and content</h2>
      <p>You may not use the service to create or reproduce:</p>
      <ul>
        <li>
          <strong>Counterfeit or deceptive labels</strong> — labels that
          imitate another company&apos;s product, packaging, or trade dress;
          labels intended to pass one product off as another; or labels
          misrepresenting a product&apos;s identity, contents, origin,
          strength, or certification.
        </li>
        <li>
          <strong>Trademark or copyright infringement</strong> — logos, brand
          names, artwork, fonts, or other material you do not have the right
          to use. See the{" "}
          <Link href="/legal/ip-policy">IP &amp; Content Policy</Link> for how
          rights holders can report infringement.
        </li>
        <li>
          <strong>Brand impersonation</strong> — labels designed to make a
          product appear to be made, endorsed, or certified by a brand,
          laboratory, regulator, or certification body when it is not. This
          includes counterfeit seals, fake certification marks, and imitation
          regulatory logos.
        </li>
        <li>
          <strong>Removal or falsification of legally required
          information</strong> — fabricated or falsified lot and batch
          numbers, expiry dates, net contents, ingredient declarations,
          mandatory warnings, or license identifiers; or relabeling intended
          to strip such information from a product.
        </li>
        <li>
          <strong>Labels for products unlawful in your jurisdiction</strong> —
          you are responsible for knowing whether the product you are labeling
          may lawfully be made and sold where you operate, and for the
          label content rules that apply to it (see the{" "}
          <Link href="/legal/regulatory">Regulatory Disclaimer</Link>).
        </li>
      </ul>

      <h2>3. Prohibited use of the service itself</h2>
      <ul>
        <li>
          Uploading malware or content designed to exploit the service or its
          users.
        </li>
        <li>
          Probing, disrupting, or circumventing security, rate limits, plan
          entitlements, or export watermarks.
        </li>
        <li>
          Automated scraping or bulk-downloading of templates and assets, or
          reselling templates and brand assets as templates (permitted product
          use is defined in the IP &amp; Content Policy).
        </li>
        <li>
          Reselling access to the service or sharing one account across a team
          beyond your plan&apos;s seat count.
        </li>
        <li>Harassing, deceiving, or defrauding other users or our staff.</li>
      </ul>

      <h2>4. Good-faith uses that are fine</h2>
      <p>
        To be clear: labeling your own products, private-labeling products you
        lawfully manufacture or resell with your own brand, producing labels
        for clients as a designer or print shop, and creating mockups and
        portfolio pieces clearly presented as such are all within the spirit of
        the service.
      </p>

      <h2>5. Enforcement</h2>
      <p>
        We may remove content, block exports, and suspend or terminate
        accounts that violate this policy, as described in the{" "}
        <Link href="/legal/terms">Terms of Service</Link> — immediately and
        without notice where the violation is serious (counterfeiting,
        falsified safety information, malware) and with notice and a chance to
        remedy otherwise. Where the law requires it, we cooperate with lawful
        requests from authorities.
      </p>

      <h2>6. Reporting</h2>
      <p>
        To report a label or account you believe violates this policy, email{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>{" "}
        with links or exported copies and a short description. Rights holders
        reporting infringement should use the takedown process in the{" "}
        <Link href="/legal/ip-policy">IP &amp; Content Policy</Link>.
      </p>
    </ProsePage>
  );
}
