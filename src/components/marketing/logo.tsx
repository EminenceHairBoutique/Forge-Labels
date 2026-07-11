import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-7", className)}
    >
      {/* Vial body */}
      <rect x="10" y="7" width="12" height="21" rx="3" className="fill-primary" />
      {/* Cap */}
      <rect x="11.5" y="3" width="9" height="4" rx="1.2" className="fill-accent" />
      {/* Label band */}
      <rect x="10" y="13" width="12" height="9" className="fill-primary-foreground/95" />
      <rect x="12.5" y="15.2" width="7" height="1.4" rx="0.7" className="fill-primary/80" />
      <rect x="12.5" y="18" width="5" height="1.2" rx="0.6" className="fill-primary/40" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 font-display text-lg font-semibold tracking-tight",
        className,
      )}
    >
      <LogoMark />
      <span>
        Forge<span className="text-primary">Labels</span>
      </span>
    </Link>
  );
}
