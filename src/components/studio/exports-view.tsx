"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileArchive, FileImage, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getStorageAdapter } from "@/lib/storage";
import type { ExportRecord } from "@/lib/storage/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const KIND_ICONS: Record<ExportRecord["kind"], LucideIcon> = {
  png: FileImage,
  jpg: FileImage,
  svg: FileImage,
  pdf: FileText,
  "sheet-pdf": FileText,
  zip: FileArchive,
  mockup: FileImage,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportsView() {
  const [records, setRecords] = React.useState<ExportRecord[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    getStorageAdapter()
      .listExports()
      .then((list) => {
        if (alive) setRecords(list);
      })
      .catch(() => {
        if (alive) setRecords([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Exports</h1>
        <p className="text-sm text-muted-foreground">
          A log of files exported from this browser. Files download at export
          time — this history records what was produced, not the files
          themselves.
        </p>
      </div>

      {records === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Download className="size-8 text-muted-foreground/50" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Nothing exported yet. Open a project and use{" "}
            <span className="font-medium text-foreground">Export</span> or{" "}
            <span className="font-medium text-foreground">Print sheet</span>.
          </p>
          <Link
            href="/dashboard"
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            Go to projects
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {records.map((record) => {
            const Icon = KIND_ICONS[record.kind];
            return (
              <li key={record.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{record.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.projectName} · {new Date(record.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary" className="uppercase">
                  {record.kind}
                </Badge>
                {record.dpi && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {record.dpi} DPI
                  </span>
                )}
                <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                  {formatBytes(record.byteSize)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
