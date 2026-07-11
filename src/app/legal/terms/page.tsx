import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement governing your use of Forge Labels: accounts, content ownership, subscriptions, disclaimers, and liability.",
};

export default function TermsPage() {
  return (
    <ProsePage
      title="Terms of Service"
      lead="These terms are the agreement between you and Forge Labels. By creating an account or using the service, you accept them."
      updated="July 2026"
    >
      <h2>1. The service</h2>
      <p>
        Forge Labels is a web-based design studio for vial and small-container
        labels. It provides a label size calculator, a design editor, QR and
        barcode generators, simulated material and finish previews, 3D vial
        mockups, template and brand-kit libraries, and print-oriented exports
        (PDF, PNG, SVG, and imposed print sheets). Feature availability
        depends on your plan, described on the{" "}
        <Link href="/pricing">pricing page</Link> and in the{" "}
        <Link href="/legal/subscription-policy">Subscription Policy</Link>.
        Where a workspace runs without cloud services configured
        (&quot;local demo mode&quot;), the service operates without accounts or
        billing and stores data in your browser.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must provide accurate registration information and keep it current.
        You are responsible for safeguarding your credentials and for all
        activity under your account. You must be able to form a binding
        contract in your jurisdiction to hold an account, and you may not use
        the service if it would be unlawful for you to do so. Notify us
        promptly at{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>{" "}
        if you suspect unauthorized access.
      </p>

      <h2>3. Your content</h2>
      <p>
        You retain all rights to the designs, images, fonts, text, and data
        you create in or upload to the service (&quot;User Content&quot;). We
        claim no ownership over it. So that the service can function, you grant
        us a limited, non-exclusive, worldwide license to host, store, process,
        render, back up, and transmit your User Content — solely to operate,
        maintain, and improve the service for you. This license ends when the
        content is deleted, subject to a short backup-retention window
        described in the <Link href="/legal/privacy">Privacy Policy</Link>.
        You are responsible for having the rights to everything you upload and
        for the accuracy and legality of the labels you produce.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        Your use of the service must comply with the{" "}
        <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>, which
        prohibits — among other things — counterfeit or deceptive labels,
        infringement of others&apos; intellectual property, falsification of
        legally required label information, and abuse of the service itself.
      </p>

      <h2>5. Subscriptions and billing</h2>
      <p>
        Paid plans, billing cycles, upgrades, downgrades, and cancellation are
        governed by the{" "}
        <Link href="/legal/subscription-policy">Subscription Policy</Link>;
        refunds are governed by the{" "}
        <Link href="/legal/refunds">Refund Policy</Link>. Payments are
        processed by Stripe. Billing features are only active in workspaces
        where Stripe is configured.
      </p>

      <h2>6. Templates, fonts, and our IP</h2>
      <p>
        The service, including its software, templates, and bundled assets, is
        protected by intellectual-property law. Your license to use templates
        and bundled fonts — including commercial use where your plan permits it
        — is described in the{" "}
        <Link href="/legal/ip-policy">IP &amp; Content Policy</Link>.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        Forge Labels is a design tool. It does not certify or warrant that any
        label complies with FDA, FTC, pharmaceutical, cosmetic, supplement,
        laboratory, medical, or any other regulatory requirement — verifying
        mandatory content, claims, and identifiers for your product and
        jurisdiction is your responsibility (see the{" "}
        <Link href="/legal/regulatory">Regulatory Disclaimer</Link>).
        On-screen colors, simulated finishes, and mockups can differ from
        physical output (see the{" "}
        <Link href="/legal/print-accuracy">Print Accuracy Disclaimer</Link>).
        The service is provided &quot;as is&quot; and &quot;as available&quot;,
        without warranties of any kind to the maximum extent permitted by law.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Forge Labels will not be liable
        for indirect, incidental, special, consequential, or punitive damages,
        or for lost profits, revenue, data, or goodwill — including costs of
        printed materials, label stock, or production runs based on unverified
        output. Our total liability for all claims arising out of the service
        is limited to the amount you paid us in the twelve months before the
        event giving rise to the claim (or, if you have paid nothing, USD 50).
        Nothing in these terms excludes liability that cannot be excluded by
        law.
      </p>

      <h2>9. Suspension and termination</h2>
      <p>
        You may stop using the service and delete your account at any time. We
        may suspend or terminate access for material breach of these terms or
        the Acceptable Use Policy, for legal necessity, or for extended
        non-payment — with notice where practicable. After termination you may
        request an export of your User Content within the retention window in
        the Privacy Policy, after which it is deleted.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update the service and these terms. For material changes to the
        terms we will give at least 14 days&apos; notice by email or in-app
        notice; continued use after the effective date constitutes acceptance.
        The &quot;last updated&quot; date above always reflects the current
        version.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of [Jurisdiction], excluding its
        conflict-of-law rules, and disputes are subject to the courts of
        [Jurisdiction], except where mandatory consumer-protection law in your
        country of residence provides otherwise.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>.
      </p>
    </ProsePage>
  );
}
