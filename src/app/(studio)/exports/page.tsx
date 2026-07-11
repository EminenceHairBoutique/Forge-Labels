import type { Metadata } from "next";
import { ExportsView } from "@/components/studio/exports-view";

export const metadata: Metadata = {
  title: "Export history",
  description: "Files you've exported from the studio.",
};

export default function ExportsPage() {
  return <ExportsView />;
}
