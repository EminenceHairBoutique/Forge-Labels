import type { Metadata } from "next";
import Link from "next/link";
import { supabaseUrl } from "@/lib/supabase/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { parseFieldRows } from "@/lib/verify-core";
import { Logo } from "@/components/marketing/logo";
import { Callout } from "@/components/ui/callout";

/**
 * Public batch-verification page. Tokens resolve exclusively through the
 * `get_batch_record` security-definer RPC (anon-executable). Everything
 * shown is the label owner's own text, displayed verbatim — the page
 * says so plainly and claims nothing on their behalf.
 */

export const metadata: Metadata = {
  title: "Batch verification",
  robots: { index: false, follow: false },
};

interface BatchRpcRow {
  product_name: string;
  batch_code: string;
  fields: unknown;
  notice: string | null;
  coa_path: string | null;
  coa_sha256: string | null;
  created_at: string;
  updated_at: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-background/85">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            What is Forge Labels?
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await getSupabaseServer();

  if (!supabase) {
    return (
      <Shell>
        <Callout variant="info" title="Verification isn't enabled on this deployment">
          This deployment runs in local demo mode without a database, so
          hosted verification pages can’t resolve. The label studio still
          works —{" "}
          <Link
            href="/dashboard"
            className="text-primary underline-offset-2 hover:underline"
          >
            open it here
          </Link>
          .
        </Callout>
      </Shell>
    );
  }

  const { data } = await supabase.rpc("get_batch_record", { record_token: token });
  const row = (Array.isArray(data) ? data[0] : data) as BatchRpcRow | undefined;

  if (!row) {
    return (
      <Shell>
        <Callout variant="warning" title="No record found">
          This verification link doesn’t match a published batch record. It
          may have been unpublished or removed by its owner.
        </Callout>
      </Shell>
    );
  }

  const fields = parseFieldRows(row.fields);
  const coaUrl =
    row.coa_path && supabaseUrl()
      ? `${supabaseUrl()}/storage/v1/object/public/coa/${row.coa_path}`
      : null;

  return (
    <Shell>
      <article className="space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Batch record
          </p>
          <h1 className="font-display text-3xl font-semibold">{row.product_name}</h1>
          <p className="text-sm text-muted-foreground">
            Batch <span className="font-medium text-foreground">{row.batch_code}</span>
          </p>
        </header>

        {row.notice && (
          <Callout variant="warning" title="Intended use">
            {row.notice}
          </Callout>
        )}

        {fields.length > 0 && (
          <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {fields.map((field, i) => (
              <div key={i} className="grid grid-cols-[40%_1fr] gap-3 px-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {coaUrl && (
          <section className="space-y-1 rounded-xl border border-border p-4">
            <h2 className="text-sm font-medium">Certificate of analysis</h2>
            <p className="text-sm">
              <a
                href={coaUrl}
                className="text-primary underline-offset-2 hover:underline"
                rel="nofollow noopener"
              >
                Download the COA (PDF)
              </a>
            </p>
            {row.coa_sha256 && (
              <p className="break-all text-xs text-muted-foreground">
                SHA-256 fingerprint (compare after downloading):{" "}
                <code className="font-mono">{row.coa_sha256}</code>
              </p>
            )}
          </section>
        )}

        <footer className="space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            Published {new Date(row.created_at).toLocaleDateString()} · last
            updated {new Date(row.updated_at).toLocaleDateString()}.
          </p>
          <p>
            All information on this page was entered by the label’s owner and
            is shown unchanged. Forge Labels hosts this record and does not
            test, certify, or verify the contents of any product.
          </p>
        </footer>
      </article>
    </Shell>
  );
}
