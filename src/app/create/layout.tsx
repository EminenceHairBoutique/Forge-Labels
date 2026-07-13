import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { SkipLink } from "@/components/ui/skip-link";

/**
 * Focused wizard chrome: logo, an exit, and nothing else competing with
 * the one question on screen.
 */
export default function CreateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
            Exit
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
