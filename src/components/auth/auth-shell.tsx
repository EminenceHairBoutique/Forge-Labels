import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { Callout } from "@/components/ui/callout";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Centered card layout for auth screens. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-subtle px-4 py-10">
      <Logo />
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Back to the site
      </Link>
    </div>
  );
}

/**
 * Shown on auth routes while running without Supabase: an honest explanation
 * instead of a form that couldn't work.
 */
export function CloudRequiredNotice() {
  return (
    <div className="space-y-4">
      <Callout variant="info" title="Accounts aren't set up yet">
        <span className="inline-flex items-center gap-1">
          <CloudOff className="size-3.5" aria-hidden /> This deployment runs in
          local demo mode.
        </span>{" "}
        Projects save to your browser and the full editor works without an
        account. To enable sign-in, cloud sync, and billing, an administrator
        connects a Supabase project — the step-by-step guide lives in{" "}
        <code>docs/SETUP.md</code>.
      </Callout>
      <Link
        href="/dashboard"
        className="block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        Continue to the studio
      </Link>
    </div>
  );
}

export function cloudModeActive(): boolean {
  return isSupabaseConfigured();
}
