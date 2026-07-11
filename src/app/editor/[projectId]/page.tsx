"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The editor is a pure client island: Konva renders to <canvas> and touches
 * `window` at import time, so it must never be server-rendered.
 */
const EditorShell = dynamic(
  () => import("@/components/editor/editor-shell").then((m) => m.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh flex-col gap-2 p-3">
        <Skeleton className="h-12" />
        <div className="flex flex-1 gap-2">
          <Skeleton className="w-12" />
          <Skeleton className="flex-1" />
          <Skeleton className="w-72" />
        </div>
      </div>
    ),
  },
);

export default function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = React.use(params);
  return <EditorShell projectId={projectId} />;
}
