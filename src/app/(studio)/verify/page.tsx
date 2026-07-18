import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyView } from "@/components/studio/verify-view";

export const metadata: Metadata = { title: "Verification pages" };

// useSearchParams (compose-link prefill) needs a suspense boundary.
export default function VerifyStudioPage() {
  return (
    <Suspense>
      <VerifyView />
    </Suspense>
  );
}
