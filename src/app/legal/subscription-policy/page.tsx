import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Subscription Policy",
  description:
    "How Forge Labels subscriptions work: billing cycles, prorated upgrades, downgrades at period end, read-only over-limit projects, cancellation, price changes, and taxes.",
};

export default function SubscriptionPolicyPage() {
  return (
    <ProsePage
      title="Subscription Policy"
      lead="The operating rules for paid plans: what you are billed, when changes take effect, and what happens to your work when a plan changes."
      updated="July 2026"
    >
      <h2>1. Plans</h2>
      <p>
        Forge Labels offers Free, Pro, Business, and Enterprise tiers. The
        current features, limits, and prices of each plan are published on the{" "}
        <Link href="/pricing">pricing page</Link>, which is the authoritative
        feature matrix; this policy governs how the billing around those plans
        behaves. Paid subscriptions exist only in workspaces where Stripe
        billing is configured — in local demo mode there is nothing to bill
        and features are available for evaluation.
      </p>

      <h2>2. Billing cycles</h2>
      <p>
        Paid plans are billed in advance, either monthly or yearly. Yearly
        billing is charged once per year at the discounted per-month rate
        shown on the pricing page. Your billing date is the date you first
        subscribed, and renewals repeat on that date each period until you
        cancel. Invoices and receipts are issued by Stripe and available in
        the billing portal.
      </p>

      <h2>3. Upgrades</h2>
      <p>
        Upgrades (Free → Pro, Pro → Business, monthly → yearly) take effect{" "}
        <strong>immediately</strong>. Stripe prorates the charge, so you pay
        only the difference for the remainder of the current period, and the
        new entitlements — exports, finishes, seats, and the rest — unlock as
        soon as payment succeeds.
      </p>

      <h2>4. Downgrades and cancellation</h2>
      <p>
        Downgrades and cancellations take effect at the{" "}
        <strong>end of the current billing period</strong>. You keep the plan
        you paid for until then, and you are not charged again afterwards.
        There is no cancellation fee, and you can resubscribe at any time.
        Manage all of this from the Stripe billing portal linked in account
        settings, or by emailing{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>.
      </p>

      <h2>5. Over-limit behavior: read-only, never deleted</h2>
      <p>
        If a downgrade leaves you over the new plan&apos;s limits, we never
        delete your work:
      </p>
      <ul>
        <li>
          <strong>Projects</strong> beyond the plan&apos;s saved-project limit
          become <strong>read-only</strong> — you can open and view them, but
          not edit them. Deleting other projects or upgrading makes them
          editable again.
        </li>
        <li>
          <strong>Storage</strong> above the plan&apos;s quota blocks new
          uploads until you are back under it; existing files stay intact.
        </li>
        <li>
          <strong>Plan-gated features</strong> (for example print-ready PDF,
          finishes, brand kits) simply deactivate; anything built with them
          remains in your projects and re-activates on upgrade.
        </li>
      </ul>

      <h2>6. Seats (Business)</h2>
      <p>
        Business includes up to five team members. Seats are for named
        individuals in your team; sharing one login to exceed the seat count
        violates the <Link href="/legal/acceptable-use">Acceptable Use
        Policy</Link>. Enterprise seat counts are set by agreement.
      </p>

      <h2>7. Price changes</h2>
      <p>
        If we change the price of a plan you are subscribed to, we will notify
        you at least <strong>30 days</strong> before the change affects you,
        and it applies from your next renewal after that notice — never
        mid-period. If you don&apos;t accept the new price, cancel before the
        renewal and the change never touches you.
      </p>

      <h2>8. Taxes</h2>
      <p>
        Prices are listed in US dollars and exclude taxes unless stated
        otherwise. Where required, VAT, GST, or sales tax is calculated and
        added at checkout by Stripe based on your billing address. Business
        customers can add their tax ID in the billing portal so invoices carry
        it.
      </p>

      <h2>9. Failed payments</h2>
      <p>
        If a renewal charge fails, Stripe retries it over several days and
        emails you to update the payment method. If payment ultimately cannot
        be collected, the subscription lapses to Free with the over-limit
        behavior of section 5 — your work stays safe, and paying again
        restores the plan.
      </p>

      <h2>10. Refunds</h2>
      <p>
        Refunds are governed by the separate{" "}
        <Link href="/legal/refunds">Refund Policy</Link>, including the 14-day
        first-purchase window.
      </p>
    </ProsePage>
  );
}
