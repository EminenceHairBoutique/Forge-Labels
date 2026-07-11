import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "IP & Content Policy",
  description:
    "Who owns what on Forge Labels: your designs stay yours, how the template license works, OFL font licensing, uploaded fonts, and copyright takedowns.",
};

export default function IpPolicyPage() {
  return (
    <ProsePage
      title="IP & Content Policy"
      lead="Three questions come up constantly: who owns my designs, what may I do with your templates, and what about fonts? Here are the answers, plus how rights holders can reach us."
      updated="July 2026"
    >
      <h2>1. Your content is yours</h2>
      <p>
        Designs you create and files you upload remain your property. Forge
        Labels claims no ownership of your work and takes only the limited
        hosting license described in the{" "}
        <Link href="/legal/terms">Terms of Service</Link> — enough to store,
        render, and export your projects for you, nothing more. We do not use
        your designs for marketing or to train models without your explicit
        consent. In return, you warrant that you have the rights to what you
        upload: your logo, your artwork, your photography, your fonts.
      </p>

      <h2>2. Our intellectual property</h2>
      <p>
        The Forge Labels software, website, name, logo, template library, and
        bundled assets are our intellectual property or that of our licensors.
        Using the service does not transfer any of it to you beyond the
        licenses granted here.
      </p>

      <h2>3. The template license</h2>
      <p>
        Templates (and template-bundled graphics) are licensed, not sold, and
        the license follows your plan:
      </p>
      <ul>
        <li>
          <strong>Personal and evaluation use</strong> — all plans may use
          templates to design, learn, and produce labels for personal,
          non-commercial projects.
        </li>
        <li>
          <strong>Commercial use</strong> — plans that include commercial
          template use (see the <Link href="/pricing">plan comparison</Link>)
          may use templates in labels for products you sell, in unlimited
          quantities, without attribution.
        </li>
        <li>
          <strong>What no plan allows</strong> — redistributing, reselling, or
          sublicensing templates or template assets <em>as templates</em> or as
          part of a competing library, generator, or asset pack. Turning a
          template into your product&apos;s label: yes. Selling the template:
          no. The same restriction applies to bundled brand-kit starter assets.
        </li>
      </ul>
      <p>
        Designs you build <em>from</em> a template are your content — the
        restriction is on the template as a reusable artifact, not on your
        finished label.
      </p>

      <h2>4. Fonts</h2>
      <ul>
        <li>
          <strong>Bundled fonts</strong> are licensed under the SIL Open Font
          License (OFL) — see the font license notice distributed with the
          application. The OFL permits commercial use and embedding in your
          exported artwork, which is exactly why we chose OFL faces.
        </li>
        <li>
          <strong>Fonts you upload</strong> are governed by <em>your</em>{" "}
          license with the font&apos;s foundry. You are responsible for
          holding a license that permits desktop/print use, embedding in
          exported files, and commercial use where applicable. Many free-font
          licenses do not cover commercial products — check before you ship.
        </li>
      </ul>

      <h2>5. Feedback</h2>
      <p>
        If you send us ideas or suggestions, we may use them to improve the
        service without obligation to you — please don&apos;t send anything
        you consider confidential.
      </p>

      <h2>6. Copyright and trademark complaints (takedown)</h2>
      <p>
        We respond to infringement notices in the spirit of the DMCA. If you
        believe content hosted on Forge Labels infringes your copyright or
        trademark, email{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>{" "}
        with the subject &quot;Takedown notice&quot; and include:
      </p>
      <ul>
        <li>identification of the protected work (registration details where they exist);</li>
        <li>the URL or sufficient description of the allegedly infringing material;</li>
        <li>your contact details;</li>
        <li>
          a good-faith statement that the use is unauthorized, and that your
          notice is accurate and made under penalty of perjury; and
        </li>
        <li>your physical or electronic signature.</li>
      </ul>
      <p>
        We will remove or disable access to material subject to a valid
        notice, inform the user, and accept counter-notices with equivalent
        formalities. Accounts that repeatedly infringe are terminated, as
        described in the{" "}
        <Link href="/legal/acceptable-use">Acceptable Use Policy</Link> and
        Terms.
      </p>
    </ProsePage>
  );
}
