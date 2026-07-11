"use client";

import * as React from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { setStorageAdapter } from "@/lib/storage";
import { LocalAdapter } from "@/lib/storage/local";
import { SupabaseAdapter } from "@/lib/storage/supabase-adapter";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Boots auth state and swaps the storage adapter with the session:
 * - no Supabase env → permanent local mode
 * - signed in → SupabaseAdapter (cloud CRUD under RLS)
 * - signed out → LocalAdapter (guests still get the full editor)
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const supabase = getSupabaseBrowser();
    const setState = useAuthStore.getState().setState;
    if (!supabase) {
      setState("local", null);
      return;
    }

    setState("loading", null);

    const apply = async (userId: string | undefined, email: string | undefined) => {
      if (!userId || !email) {
        setStorageAdapter(new LocalAdapter());
        setState("signed-out", null);
        return;
      }
      setStorageAdapter(new SupabaseAdapter(supabase, userId));
      // Platform role (admin) — readable for self under RLS.
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setState("signed-in", { id: userId, email }, roleRow?.role === "admin");
    };

    void (async () => {
      const { data } = await supabase.auth.getUser();
      await apply(data.user?.id, data.user?.email ?? undefined);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: { id: string; email?: string } } | null) => {
        void apply(session?.user.id, session?.user.email ?? undefined);
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
