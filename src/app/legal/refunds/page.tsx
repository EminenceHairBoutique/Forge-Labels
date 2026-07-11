import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Forge Labels refunds: a 14-day window on your first subscription purchase if no high-resolution exports were produced, renewal rules, and how to request one.",
};

export default function RefundsPage() {
  return (
    <ProsePage
      title="Refund Policy"
      lead="A refund policy should be checkable, not vibes. Ours is built around one measurable question: did you actually use the paid features?"
      updated="July 2026"
    >
      <h2>1. The 14-day first-purchase refund</h2>
      <p>
        Your <strong>first</strong> subscription purchase (Pro or Business,
        monthly or yearly) is refundable in full within <strong>14 days</strong>{" "}
        of payment, provided your account has not produced high-resolution
        exports in that time — meaning the paid export paths: print-ready PDF,
        600 DPI raster, or SVG vector exports. That condition is deliberate
        and honest: it is objective, we can verify it from export logs rather
        than argue about it, and it distinguishes &quot;tried it and it&apos;s
        not for me&quot; (refunded, gladly) from &quot;produced the print
        files and then asked for the money back&quot; (not refunded).
      </p>
      <p>
        Everything that doesn&apos;t consume the paid export paths — designing,
        previewing finishes and mockups, standard 300 DPI PNG exports — leaves
        your refund eligibility intact during those 14 days.
      </p>

      <h2>2. Monthly renewals</h2>
      <p>
        Renewal payments for monthly subscriptions are non-refundable. Instead
        of refunding renewals, we make leaving easy: cancel anytime before the
        renewal date from the Stripe billing portal and you keep access until
        the end of the period you paid for, per the{" "}
        <Link href="/legal/subscription-policy">Subscription Policy</Link>.
      </p>

      <h2>3. Yearly renewals</h2>
      <p>
        Yearly renewal payments may be refunded pro-rata for the unused months
        at our discretion — we consider these case by case (for example, a
        renewal that slipped through after a project ended). Email us promptly
        after the renewal; the further into the year, the less there is to
        refund.
      </p>

      <h2>4. What refunds don&apos;t cover</h2>
      <p>
        We cannot refund costs outside the subscription itself: label stock,
        ink, printing services, or production runs — including runs based on
        unverified output (see the{" "}
        <Link href="/legal/print-accuracy">Print Accuracy Disclaimer</Link>).
        Refunds also don&apos;t apply to charges older than the windows above
        or to accounts terminated for violating the{" "}
        <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>.
      </p>

      <h2>5. How to request a refund</h2>
      <p>
        Email{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>{" "}
        from your account email address with the subject &quot;Refund
        request&quot;, and include the approximate payment date. We respond
        within a few business days; qualifying requests under section 1 are
        approved without further questions asked.
      </p>

      <h2>6. Processing times</h2>
      <p>
        Refunds are issued through Stripe to the original payment method. Once
        issued, Stripe typically settles the refund in 5–10 business days,
        depending on your bank or card issuer. We cannot redirect a refund to
        a different card or account.
      </p>

      <h2>7. Your statutory rights</h2>
      <p>
        Nothing in this policy limits rights you cannot waive. In particular,
        consumers in the EU and UK retain their statutory withdrawal and
        remedy rights; where those rights are more generous than this policy,
        the law wins. Note that statutory withdrawal rights for digital
        services can lapse once the service is fully used with your
        acknowledgment — which is consistent with the export-based condition
        in section 1.
      </p>
    </ProsePage>
  );
}
