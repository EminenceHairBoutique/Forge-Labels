import * as React from "react";
import type { Metadata } from "next";
import { CreateWizard } from "@/components/easy/create-wizard";

export const metadata: Metadata = {
  title: "Make a new label",
  description:
    "Answer a few simple questions — vial, material, style — and get professional label designs sized exactly for your container.",
};

export default function CreatePage() {
  return (
    // useSearchParams (wizard step) needs a Suspense boundary for prerender.
    <React.Suspense fallback={null}>
      <CreateWizard />
    </React.Suspense>
  );
}
