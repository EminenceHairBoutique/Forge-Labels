import type { Metadata } from "next";
import { BrandKitsView } from "@/components/studio/brand-kits-view";

export const metadata: Metadata = {
  title: "Brand kits",
  description: "Reusable brand colors, fonts, logos, and standard text.",
};

export default function BrandKitsPage() {
  return <BrandKitsView />;
}
