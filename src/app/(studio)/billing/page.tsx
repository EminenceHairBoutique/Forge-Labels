import type { Metadata } from "next";
import { BillingView } from "@/components/studio/billing-view";

export const metadata: Metadata = {
  title: "Billing",
  description: "Your plan and billing management.",
};

export default function BillingPage() {
  return <BillingView />;
}
