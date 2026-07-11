"use client";

import Link from "next/link";
import { HardDrive } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Persistent notice while projects save to the browser: either the
 * deployment has no cloud configured (local demo mode) or the visitor is a
 * signed-out guest. Honest state, not an error.
 */
export function LocalModeBanner() {
  const status = useAuthStore((s) => s.status);
  if (status === "signed-in" || status === "loading") return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs text-warning-foreground">
      <HardDrive className="size-3.5 shrink-0" aria-hidden />
      {status === "local" ? (
        <p>
          <strong className="font-medium">Local demo mode</strong> — projects are
          saved in this browser only.{" "}
          <Link href="/help#accounts" className="underline underline-offset-2">
            Connect Supabase to enable accounts &amp; cloud sync
          </Link>
          .
        </p>
      ) : (
        <p>
          <strong className="font-medium">Guest mode</strong> — projects save to
          this browser.{" "}
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>{" "}
          to sync them to your account.
        </p>
      )}
    </div>
  );
}
