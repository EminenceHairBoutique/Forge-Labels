import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "The small number of cookies and browser-storage entries Forge Labels uses — session auth, theme preference, local projects — and how to control them.",
};

export default function CookiesPage() {
  return (
    <ProsePage
      title="Cookie Policy"
      lead="Forge Labels uses a deliberately small set of cookies and browser storage. There are no third-party advertising trackers. Here is the complete inventory."
      updated="July 2026"
    >
      <h2>1. What cookies and browser storage are</h2>
      <p>
        Cookies are small text records a website stores in your browser and
        receives back on later visits; localStorage and similar browser
        storage are records that stay in the browser and are read by the page
        itself. We use both — sparingly, and only for the service to work.
      </p>

      <h2>2. What we actually use</h2>
      <ul>
        <li>
          <strong>Session authentication cookies</strong> (cloud mode only).
          When a workspace has cloud services configured and you sign in,
          Supabase authentication sets session cookies so you stay signed in
          across pages and visits. These are strictly necessary for accounts
          to function and exist only when you have an account and are signed
          in.
        </li>
        <li>
          <strong>Theme preference</strong> (localStorage). Your light/dark
          choice is stored in the browser so the interface renders in your
          preferred theme without a flash. It never leaves your device.
        </li>
        <li>
          <strong>Local projects and settings</strong> (browser storage, local
          demo mode). Without cloud services configured, your projects,
          autosaves, and editor settings are stored in your browser&apos;s
          storage. This is your data staying on your machine — see the{" "}
          <Link href="/legal/privacy">Privacy Policy</Link> for what that
          means.
        </li>
        <li>
          <strong>Stripe checkout</strong>. If you subscribe, Stripe&apos;s
          checkout and billing portal set their own cookies on Stripe&apos;s
          domains for payment security and fraud prevention, governed by
          Stripe&apos;s privacy policy.
        </li>
      </ul>

      <h2>3. What we do not use</h2>
      <p>
        No third-party advertising trackers, no cross-site tracking pixels, no
        social-media widgets that report your visit, and no analytics cookies
        from ad networks. Product analytics, where enabled, are first-party
        and described in the Privacy Policy.
      </p>

      <h2>4. How to control them</h2>
      <p>
        Your browser can block or delete cookies and site data for any site
        (usually under Settings → Privacy → Site data). Two practical
        consequences with Forge Labels:
      </p>
      <ul>
        <li>
          Blocking or clearing cookies in cloud mode signs you out; you can
          simply sign in again.
        </li>
        <li>
          Clearing site data in local demo mode{" "}
          <strong>permanently deletes your locally stored projects</strong> —
          export any design you care about first.
        </li>
      </ul>
      <p>
        Because we set no optional tracking cookies, there is no cookie
        consent banner to manage: everything we store is either strictly
        necessary or a preference you set yourself.
      </p>

      <h2>5. Changes and contact</h2>
      <p>
        If we ever add a cookie category beyond the above, we will update this
        policy first and, where consent is legally required, ask for it.
        Questions:{" "}
        <a href="mailto:hello@forgelabels.example">hello@forgelabels.example</a>.
      </p>
    </ProsePage>
  );
}
