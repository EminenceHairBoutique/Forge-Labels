import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/marketing/logo";
import { Callout } from "@/components/ui/callout";
import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = {
  title: "Team invitation",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-background/85">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}

export default async function AcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const supabase = await getSupabaseServer();

  if (!supabase) {
    return (
      <Shell>
        <Callout variant="info" title="Teams aren't enabled on this deployment">
          This deployment runs in local demo mode without a database, so team
          invitations can’t be accepted here.
        </Callout>
      </Shell>
    );
  }

  if (!token) {
    return (
      <Shell>
        <Callout variant="warning" title="Missing invitation token">
          Open the full invitation link you were sent, or ask for a new one.
        </Callout>
      </Shell>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/team/accept?token=${token}`);
    return (
      <Shell>
        <Callout variant="info" title="Sign in to accept the invitation">
          Sign in with the email address the invitation was sent to, then
          you’ll return here automatically.{" "}
          <Link
            href={`/login?next=${next}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            Sign in
          </Link>{" "}
          ·{" "}
          <Link
            href={`/signup?next=${next}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </Callout>
      </Shell>
    );
  }

  return (
    <Shell>
      <AcceptInvitation token={token} email={user.email ?? ""} />
    </Shell>
  );
}
