import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/marketing/logo";
import { Callout } from "@/components/ui/callout";
import { ShareViewer } from "./share-viewer";

/**
 * Public shared-project page. Tokens resolve exclusively through the
 * `get_shared_project` security-definer RPC (anon-executable) — anonymous
 * visitors have no table access, and the RPC enforces revocation and expiry.
 */

export const metadata: Metadata = {
  title: "Shared label",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-background/85">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            What is Forge Labels?
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await getSupabaseServer();

  if (!supabase) {
    return (
      <Shell>
        <Callout variant="info" title="Sharing isn't enabled on this deployment">
          This deployment runs in local demo mode without a database, so share
          links can’t resolve. The full editor still works —{" "}
          <Link href="/dashboard" className="text-primary underline-offset-2 hover:underline">
            open the studio
          </Link>
          .
        </Callout>
      </Shell>
    );
  }

  const { data, error } = await supabase.rpc("get_shared_project", {
    link_token: token,
  });
  const row = Array.isArray(data) ? (data[0] as
    | { project_name: string; doc: unknown; mode: "view" | "edit" }
    | undefined) : undefined;

  if (error || !row) {
    return (
      <Shell>
        <Callout variant="warning" title="This link isn't available">
          It may have been revoked, expired, or mistyped. Ask the person who
          shared it for a fresh link.
        </Callout>
      </Shell>
    );
  }

  return (
    <Shell>
      <ShareViewer projectName={row.project_name} rawDoc={row.doc} mode={row.mode} />
    </Shell>
  );
}
