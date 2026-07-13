"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Easy editor island: Konva (label texture) and three.js (vial scene)
 * both need the DOM, so the shell is client-only like the Advanced Editor.
 */
const EasyEditor = dynamic(
  () => import("@/components/easy/easy-editor").then((m) => m.EasyEditor),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl space-y-3 p-4">
        <Skeleton className="h-12" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    ),
  },
);

export default function EasyPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = React.use(params);
  return <EasyEditor projectId={projectId} />;
}
