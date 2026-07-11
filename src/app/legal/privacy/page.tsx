import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data Forge Labels collects, how local demo mode keeps data in your browser, our subprocessors, and your rights to export and deletion.",
};

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy Policy"
      lead="This policy explains what data Forge Labels collects, why, where it lives, and the rights you have over it."
      updated="July 2026"
    >
      <h2>1. Two modes, two very different footprints</h2>
      <p>
        Forge Labels runs in one of two modes, and your privacy picture depends
        on which one you are using:
      </p>
      <ul>
        <li>
          <strong>Local demo mode</strong> — when a workspace runs without
          cloud services configured, there are no accounts and no server-side
          storage of your work. Projects, settings, and uploads are stored only
          in your own browser (localStorage and browser storage). We cannot see
          them; clearing your browser data removes them.
        </li>
        <li>
          <strong>Cloud mode</strong> — when accounts are enabled, the data
          described below is stored on our infrastructure so you can sign in,
          sync, and subscribe.
        </li>
      </ul>

      <h2>2. Data we collect in cloud mode</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email address, authentication
          records, and plan status.
        </li>
        <li>
          <strong>Your work:</strong> projects, designs, version history,
          brand kits, and files you upload (images, fonts).
        </li>
        <li>
          <strong>Usage analytics:</strong> basic product events (for example,
          which features are used and coarse error diagnostics) used to
          improve the service. We do not sell this data or use third-party
          advertising trackers.
        </li>
        <li>
          <strong>Payment data:</strong> handled by Stripe. Card numbers are
          entered on and processed by Stripe;{" "}
          <strong>we never receive or store your card number</strong>. We
          store only the subscription state and Stripe&apos;s references
          (customer and subscription IDs).
        </li>
      </ul>

      <h2>3. How we use data</h2>
      <p>
        To operate the service (rendering, saving, exporting your work), to
        authenticate you, to bill subscriptions, to provide support when you
        contact us, to secure the service against abuse, and to understand — in
        aggregate — how features are used. We do not sell personal data and we
        do not use your designs to train models or for marketing without your
        explicit consent.
      </p>

      <h2>4. Cookies and browser storage</h2>
      <p>
        Cloud mode uses session cookies for authentication; both modes use
        browser storage for preferences (such as theme) and, in local demo
        mode, for your projects themselves. The full inventory and your
        controls are in the <Link href="/legal/cookies">Cookie Policy</Link>.
      </p>

      <h2>5. Retention and deletion</h2>
      <p>
        Account data and your work are retained while your account exists.
        When you delete a project it is removed from your workspace
        immediately and purged from active systems promptly; when you delete
        your account, associated personal data and content are deleted from
        active systems within 30 days, and from encrypted backups as those
        backups expire (at most 90 days). We may retain minimal records where
        the law requires it (for example, invoices for tax purposes, retained
        by Stripe and our accounting).
      </p>

      <h2>6. Your rights</h2>
      <p>
        Wherever you live, we extend the same core rights: access and export
        (you can export your designs at any time, and request a copy of your
        account data in a portable format), correction, deletion, and
        objection to processing. If you are in the EEA, UK, or a jurisdiction
        with similar law, these correspond to your statutory rights, and you
        may also lodge a complaint with your supervisory authority. To
        exercise any right, email{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>{" "}
        from your account address.
      </p>

      <h2>7. Subprocessors</h2>
      <p>We use a deliberately short list of infrastructure providers:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication, database, and file
          storage hosting.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing and subscription
          billing.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and content delivery.
        </li>
      </ul>
      <p>
        Each processes data only to provide its service to us. We will update
        this list before adding a subprocessor that handles personal data.
      </p>

      <h2>8. Security</h2>
      <p>
        Data in cloud mode is encrypted in transit and at rest by our
        infrastructure providers, access is restricted and logged, and
        authentication is delegated to Supabase&apos;s hardened auth system.
        No system is perfectly secure — if we learn of a breach affecting your
        personal data, we will notify you as required by law.
      </p>

      <h2>9. Children</h2>
      <p>
        The service is not directed at children and may not be used by anyone
        below the age at which they can validly consent to data processing in
        their jurisdiction.
      </p>

      <h2>10. Changes and contact</h2>
      <p>
        We will announce material changes to this policy by email or in-app
        notice before they take effect. Questions and requests:{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>.
      </p>
    </ProsePage>
  );
}
