import Link from "next/link";
import { FolderOpen, Image as ImageIcon, Palette, Settings, Download } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ImportLocalDialog } from "@/components/auth/import-local-dialog";
import { UserMenu } from "@/components/auth/user-menu";
import { LocalModeBanner } from "@/components/studio/local-mode-banner";
import { Button } from "@/components/ui/button";

const STUDIO_NAV = [
  { href: "/dashboard", label: "Projects", icon: FolderOpen },
  { href: "/brand-kits", label: "Brand kits", icon: Palette },
  { href: "/assets", label: "Assets", icon: ImageIcon },
  { href: "/exports", label: "Exports", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <LocalModeBanner />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo />
            <nav aria-label="Studio" className="hidden items-center gap-1 md:flex">
              {STUDIO_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to site</Link>
            </Button>
          </div>
        </div>
        <nav
          aria-label="Studio mobile"
          className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1 md:hidden"
        >
          {STUDIO_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-3.5" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <ImportLocalDialog />
    </div>
  );
}
