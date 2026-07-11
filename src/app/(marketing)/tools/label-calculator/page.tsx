import type { Metadata } from "next";
import { LabelCalculator } from "@/components/calculator/label-calculator";

export const metadata: Metadata = {
  title: "Vial label size calculator",
  description:
    "Calculate exact label dimensions for any cylindrical vial: full-wrap width from circumference, printable height, bleed, and safe zones — in mm, cm, or inches.",
};

export default function LabelCalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Vial label size calculator
        </h1>
        <p className="mt-3 text-muted-foreground">
          Enter your vial&apos;s measurements to get exact label dimensions.
          Full-wrap width is the true circumference (diameter × π) minus your
          seam gap; height is the straight wall with a little clearance. Every
          value carries into the editor at physical size.
        </p>
      </div>
      <div className="mt-10">
        <LabelCalculator />
      </div>
    </div>
  );
}
