"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";

let client: SupabaseClient | null = null;

/** Browser Supabase client (singleton). Null when cloud mode is off. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createBrowserClient(supabaseUrl()!, supabaseAnonKey()!);
  return client;
}
