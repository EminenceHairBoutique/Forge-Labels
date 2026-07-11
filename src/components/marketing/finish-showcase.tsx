import { cn } from "@/lib/utils";

/**
 * CSS-only material swatches for marketing pages. The editor's finish engine
 * (lib/finishes) renders the real, export-consistent simulations; these are
 * lightweight illustrative previews.
 */

const SWATCHES = [
  {
    name: "Holographic",
    className:
      "bg-[conic-gradient(from_210deg_at_50%_50%,#ff9a9e,#fad0c4,#a1c4fd,#c2f7d4,#fddb92,#f6a6ff,#ff9a9e)]",
  },
  {
    name: "Gold foil",
    className:
      "bg-[linear-gradient(135deg,#8a6a1f_0%,#d4af5f_25%,#f7e8b0_50%,#caa64f_75%,#8a6a1f_100%)]",
  },
  {
    name: "Silver foil",
    className:
      "bg-[linear-gradient(135deg,#6b7280_0%,#d1d5db_30%,#f9fafb_50%,#9ca3af_70%,#4b5563_100%)]",
  },
  {
    name: "Rose gold",
    className:
      "bg-[linear-gradient(135deg,#9c5f52_0%,#d99a8b_30%,#f6d4c8_52%,#c97f6f_75%,#8d5348_100%)]",
  },
  {
    name: "Brushed metal",
    className:
      "bg-[repeating-linear-gradient(90deg,#a8adb5_0px,#d7dade_1px,#b9bec6_2px,#cdd1d7_3px)]",
  },
  {
    name: "Clear / frosted",
    className:
      "border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.7),rgba(226,232,240,0.35))] backdrop-blur-sm dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(148,163,184,0.08))]",
  },
  {
    name: "Matte black",
    className: "bg-[linear-gradient(135deg,#1c1c1f,#2b2b30)]",
  },
  {
    name: "Kraft paper",
    className:
      "bg-[linear-gradient(135deg,#b48a5f,#c69c6d_40%,#ad8154_70%,#bd9364)]",
  },
] as const;

export function FinishShowcase({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-4",
        className,
      )}
    >
      {SWATCHES.map((swatch) => (
        <li key={swatch.name} className="group">
          <div
            className={cn(
              "relative h-24 overflow-hidden rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-[1.02]",
              swatch.className,
            )}
          >
            {/* moving sheen */}
            <div
              aria-hidden
              className="absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.45)_50%,transparent_60%)] transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
            />
          </div>
          <p className="mt-2 text-sm font-medium">{swatch.name}</p>
        </li>
      ))}
    </ul>
  );
}
