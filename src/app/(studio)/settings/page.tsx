import type { Metadata } from "next";
import { SettingsView } from "@/components/studio/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Appearance, data, and workspace settings.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
