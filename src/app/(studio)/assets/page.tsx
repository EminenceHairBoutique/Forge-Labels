import type { Metadata } from "next";
import { AssetsView } from "@/components/studio/assets-view";

export const metadata: Metadata = {
  title: "Saved assets",
  description: "Logos and images you've uploaded.",
};

export default function AssetsPage() {
  return <AssetsView />;
}
