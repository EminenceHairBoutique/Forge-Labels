"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Settings, Shield, UserRound } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Session control for the studio header (renders nothing in local mode). */
export function UserMenu() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const router = useRouter();

  if (status === "local" || status === "loading") return null;

  if (status === "signed-out") {
    return (
      <Button asChild size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  async function signOut() {
    await getSupabaseBrowser()?.auth.signOut();
    router.push("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Account menu">
          <UserRound className="size-4" aria-hidden />
          <span className="max-w-40 truncate">{user?.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> Admin dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/billing">
            <CreditCard /> Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
