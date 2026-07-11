import type { StorageAdapter } from "./types";
import { LocalAdapter } from "./local";

/**
 * Adapter selection. Cloud mode (SupabaseAdapter) activates when the
 * Supabase environment is configured AND the user is signed in; everything
 * else uses the local adapter. The SupabaseAdapter lands with the cloud
 * milestone — this module is the single switch point.
 */

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  adapter ??= new LocalAdapter();
  return adapter;
}

/** Cloud milestone: swap the active adapter after sign-in/sign-out. */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
