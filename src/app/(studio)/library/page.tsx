"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Standalone template gallery: browse the whole library on a standard
 * 10 mL vial with sample words, pick one, and it becomes a new label.
 * (The same browser opens inside the Easy editor bound to YOUR label.)
 */

const TemplateBrowser = dynamic(
  () =>
    import("@/components/easy/template-browser").then(
      (m) => m.TemplateBrowser,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl space-y-3 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    ),
  },
);

export default function TemplatesPage() {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);
  return (
    <TemplateBrowser
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.push("/dashboard");
      }}
    />
  );
}
