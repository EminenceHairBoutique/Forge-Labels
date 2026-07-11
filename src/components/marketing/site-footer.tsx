import Link from "next/link";
import { COMPLIANCE_NOTICE, FOOTER_GROUPS, SITE } from "@/lib/site";
import { Logo } from "@/components/marketing/logo";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-subtle">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{SITE.description}</p>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3 className="mb-3 text-sm font-semibold">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <Separator className="my-8" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Compliance notice:</strong>{" "}
          {COMPLIANCE_NOTICE}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
