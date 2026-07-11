import Link from "next/link";
import { Calculator } from "lucide-react";

const GUIDE_LINKS = [
  { href: "/guides/vial-sizes", label: "Vial size guide" },
  { href: "/guides/printing", label: "Printing guide" },
  { href: "/guides/materials", label: "Materials & finishes" },
] as const;

export default function GuidesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto grid max-w-6xl gap-x-10 px-4 sm:px-6 lg:grid-cols-[220px_1fr]">
      <nav
        aria-label="Guides"
        className="pt-10 lg:sticky lg:top-24 lg:self-start lg:py-12"
      >
        <h2 className="mb-3 text-sm font-semibold">Guides</h2>
        <ul className="space-y-2">
          {GUIDE_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="pt-2">
            <Link
              href="/tools/label-calculator"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Calculator className="size-3.5" aria-hidden />
              Label size calculator
            </Link>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
