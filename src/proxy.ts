import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 proxy (the middleware successor): refreshes the Supabase session
 * cookie on navigation so server components always see a valid session.
 * A no-op while the app runs in local demo mode.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh the token if needed. Nothing may run between client creation
  // and getUser(), per Supabase SSR guidance.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets; run on app + auth routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|env/|.*\\.(?:svg|png|jpg|webp|hdr)$).*)"],
};
