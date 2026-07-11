import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * OAuth / magic-link / email-confirmation landing: exchanges the auth code
 * for a session cookie, then forwards to `next` (same-origin only).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") ?? "/dashboard";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";

  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
