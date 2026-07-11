"use client";

import Link from "next/link";
import { HardDrive } from "lucide-react";
import { getStorageAdapter } from "@/lib/storage";

/**
 * Persistent notice while running without cloud credentials: projects live
 * in this browser only. Honest state, not an error.
 */
export function LocalModeBanner() {
  const capabilities = getStorageAdapter().capabilities;
  if (capabilities.mode !== "local") return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs text-warning-foreground">
      <HardDrive className="size-3.5 shrink-0" aria-hidden />
      <p>
        <strong className="font-medium">Local demo mode</strong> — projects are saved
        in this browser only.{" "}
        <Link href="/help#accounts" className="underline underline-offset-2">
          Connect Supabase to enable accounts &amp; cloud sync
        </Link>
        .
      </p>
    </div>
  );
}
