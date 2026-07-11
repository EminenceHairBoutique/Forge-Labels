import type { Metadata } from "next";
import { ProjectsView } from "@/components/studio/projects-view";

export const metadata: Metadata = {
  title: "Your projects",
  description: "Create, open, and manage your vial label projects.",
};

export default function DashboardPage() {
  return <ProjectsView />;
}
