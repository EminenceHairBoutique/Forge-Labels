import type { Metadata } from "next";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Admin",
  description: "Platform administration.",
};

export default function AdminPage() {
  return <AdminView />;
}
