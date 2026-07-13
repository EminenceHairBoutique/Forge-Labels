"use client";

import * as React from "react";
import Link from "next/link";
import { Table2 } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import { MAX_BATCH_ROWS, parseCsv, type CsvParseResult } from "@/lib/batch/csv";
import { extractTokens, substituteTokens, uniqueTokens } from "@/lib/batch/tokens";
import { validateRow, type RowIssue } from "@/lib/batch/validate";
import { generateBatchZip, WARN_ZIP_BYTES } from "@/lib/batch/generate";
import { sanitizeFileName } from "@/lib/batch/filename";
import {
  resolveEntitlements,
  type ResolvedEntitlements,
} from "@/lib/billing/entitlements";
import { renderThumbnail } from "@/lib/export/raster";
import { getStorageAdapter } from "@/lib/storage";
import { useProjectSessionStore } from "@/stores/project-session-store";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";

/**
 * CSV batch export: detect {{tokens}} in the document, map them to CSV
 * columns, preview + validate rows, and export one PNG per row as a ZIP.
 */

const LITERAL = -1; // mapping sentinel: leave the token as literal text

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Case/format-insensitive header auto-match for a token. */
function autoMatchColumn(token: string, headers: string[]): number {
  const normalize = (s: string) => s.trim().toLowerCase().replaceAll(/[ _-]/g, "");
  const target = normalize(token);
  const index = headers.findIndex((h) => normalize(h) === target);
  return index === -1 ? LITERAL : index;
}

interface BatchDialogProps {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BatchDialog({ doc, open, onOpenChange }: BatchDialogProps) {
  const projectName = useProjectSessionStore((s) => s.projectName);
  const projectId = useProjectSessionStore((s) => s.projectId);

  const refs = React.useMemo(() => extractTokens(doc), [doc]);
  const tokens = React.useMemo(() => uniqueTokens(refs), [refs]);

  const [entitlements, setEntitlements] = React.useState<ResolvedEntitlements | null>(
    null,
  );
  const [csv, setCsv] = React.useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, number>>({});
  const [previewRow, setPreviewRow] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [dpi, setDpi] = React.useState<300 | 600>(300);
  const [mode, setMode] = React.useState<"print" | "sticker">("sticker");
  const [filenameColumn, setFilenameColumn] = React.useState<number>(LITERAL);
  const [skipInvalid, setSkipInvalid] = React.useState(true);
  const [issues, setIssues] = React.useState<RowIssue[] | null>(null);
  const [progress, setProgress] = React.useState<{
    done: number;
    total: number;
    estimatedZipBytes?: number;
  } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Resolve plan gating when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    resolveEntitlements().then((resolved) => {
      if (alive) setEntitlements(resolved);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // Live per-row preview thumbnail (reset happens in onFile/handlers —
  // effects must not set state synchronously).
  React.useEffect(() => {
    if (!open || !csv || csv.rows.length === 0) return;
    let alive = true;
    const row = csv.rows[Math.min(previewRow, csv.rows.length - 1)]!;
    const record: Record<string, string> = {};
    for (const [token, column] of Object.entries(mapping)) {
      if (column !== LITERAL) record[token] = row[column] ?? "";
    }
    renderThumbnail(substituteTokens(doc, record), 640)
      .then((url) => {
        if (alive) setPreviewUrl(url);
      })
      .catch(() => {
        if (alive) setPreviewUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [open, csv, previewRow, mapping, doc]);

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    setCsv(parsed);
    setPreviewRow(0);
    setPreviewUrl(null);
    setIssues(null);
    const nextMapping: Record<string, number> = {};
    for (const token of tokens) {
      nextMapping[token] = autoMatchColumn(token, parsed.headers);
    }
    setMapping(nextMapping);
  }

  function activeMapping(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [token, column] of Object.entries(mapping)) {
      if (column !== LITERAL) out[token] = column;
    }
    return out;
  }

  function validateAll(): RowIssue[] {
    if (!csv) return [];
    const all: RowIssue[] = [];
    const map = activeMapping();
    for (let r = 0; r < csv.rows.length; r++) {
      const record: Record<string, string> = {};
      for (const [token, column] of Object.entries(map)) {
        record[token] = csv.rows[r]![column] ?? "";
      }
      all.push(...validateRow(doc, refs, record, r));
    }
    setIssues(all);
    return all;
  }

  async function runExport() {
    if (!csv) return;
    const found = issues ?? validateAll();
    const errorRows = new Set(
      found.filter((i) => i.severity === "error").map((i) => i.rowIndex),
    );
    if (errorRows.size > 0 && !skipInvalid) {
      toast.error(
        "Fix validation errors first",
        `${errorRows.size} row${errorRows.size === 1 ? "" : "s"} failed — or enable “Skip invalid rows”.`,
      );
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: csv.rows.length });
    try {
      const base = sanitizeFileName(projectName);
      const result = await generateBatchZip(
        {
          doc,
          headers: csv.headers,
          rows: csv.rows,
          mapping: activeMapping(),
          dpi,
          mode,
          baseName: base,
          filenameColumn: filenameColumn === LITERAL ? undefined : filenameColumn,
          skipInvalid,
        },
        {
          signal: controller.signal,
          onProgress: (p) =>
            setProgress({
              done: p.done,
              total: p.total,
              estimatedZipBytes: p.estimatedZipBytes,
            }),
        },
      );
      const fileName = `${base}-batch.zip`;
      downloadBlob(result.blob, fileName);
      await getStorageAdapter().recordExport({
        projectId,
        projectName,
        kind: "zip",
        fileName,
        byteSize: result.blob.size,
        dpi,
      });
      toast.success(
        "Batch export ready",
        `${result.exported} label${result.exported === 1 ? "" : "s"}${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        "Batch export failed",
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  const gated = entitlements !== null && !entitlements.entitlements.csvBatch;
  const errorCount = issues?.filter((i) => i.severity === "error").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Batch export from CSV</DialogTitle>
          <DialogDescription>
            Each CSV row fills the label’s{" "}
            <code className="text-xs">{"{{column}}"}</code> placeholders and
            exports as its own PNG (up to {MAX_BATCH_ROWS} rows per run).
          </DialogDescription>
        </DialogHeader>

        {gated ? (
          <Callout variant="info" title="CSV batch is a Business feature">
            Your current plan ({entitlements!.planName}) doesn’t include batch
            generation.{" "}
            <Link href="/billing" className="text-primary underline-offset-2 hover:underline">
              Upgrade to Business
            </Link>{" "}
            to generate labeled runs from spreadsheets.
          </Callout>
        ) : tokens.length === 0 ? (
          <Callout variant="info" title="No data fields yet">
            Add <code className="text-xs">{"{{column}}"}</code> placeholders to
            text, QR, or barcode values first — e.g.{" "}
            <code className="text-xs">Lot {"{{lot}}"} — Exp {"{{expiry}}"}</code>.
            Select a text object and use “Insert data field”, then reopen this
            dialog.
          </Callout>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-3 text-xs">
              <p className="mb-1 font-medium">
                {tokens.length} data field{tokens.length === 1 ? "" : "s"} in this
                label
              </p>
              <p className="text-muted-foreground">
                {tokens.map((t) => `{{${t}}}`).join(" · ")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-csv">CSV file</Label>
              <div className="flex items-center gap-2">
                <input
                  id="batch-csv"
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full cursor-pointer text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary-hover"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFile(file);
                  }}
                />
              </div>
              {csv && (
                <p className="text-xs text-muted-foreground">
                  {csv.rows.length} row{csv.rows.length === 1 ? "" : "s"} ·{" "}
                  {csv.headers.length} column{csv.headers.length === 1 ? "" : "s"}
                  {csv.truncated ? ` (truncated to ${MAX_BATCH_ROWS})` : ""}
                </p>
              )}
              {csv && csv.errors.length > 0 && (
                <ul className="max-h-20 overflow-y-auto text-xs text-warning-foreground">
                  {csv.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {csv.errors.length > 5 && <li>…and {csv.errors.length - 5} more</li>}
                </ul>
              )}
            </div>

            {csv && csv.rows.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Field mapping</Label>
                  {tokens.map((token) => (
                    <div key={token} className="flex items-center justify-between gap-3">
                      <code className="text-xs">{`{{${token}}}`}</code>
                      <Select
                        value={String(mapping[token] ?? LITERAL)}
                        onValueChange={(v) =>
                          setMapping((m) => ({ ...m, [token]: Number(v) }))
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-44 text-xs"
                          aria-label={`Column for ${token}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={String(LITERAL)}>
                            (leave as literal text)
                          </SelectItem>
                          {csv.headers.map((header, index) => (
                            <SelectItem key={index} value={String(index)}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="batch-dpi">Resolution</Label>
                    <Select
                      value={String(dpi)}
                      onValueChange={(v) => setDpi(Number(v) as 300 | 600)}
                    >
                      <SelectTrigger id="batch-dpi" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="300">300 DPI</SelectItem>
                        <SelectItem value="600">600 DPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="batch-mode">Artwork</Label>
                    <Select
                      value={mode}
                      onValueChange={(v) => setMode(v as "print" | "sticker")}
                    >
                      <SelectTrigger id="batch-mode" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sticker">Die-cut sticker (trim)</SelectItem>
                        <SelectItem value="print">Print artwork (bleed)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="batch-filename">File names</Label>
                    <Select
                      value={String(filenameColumn)}
                      onValueChange={(v) => setFilenameColumn(Number(v))}
                    >
                      <SelectTrigger id="batch-filename" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={String(LITERAL)}>Row number</SelectItem>
                        {csv.headers.map((header, index) => (
                          <SelectItem key={index} value={String(index)}>
                            From column “{header}”
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Preview</Label>
                    <div className="flex items-center gap-1 text-xs">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={previewRow <= 0}
                        onClick={() => setPreviewRow((r) => Math.max(0, r - 1))}
                      >
                        ‹
                      </Button>
                      <span className="tabular-nums">
                        row {Math.min(previewRow, csv.rows.length - 1) + 1}/
                        {csv.rows.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={previewRow >= csv.rows.length - 1}
                        onClick={() =>
                          setPreviewRow((r) => Math.min(csv.rows.length - 1, r + 1))
                        }
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`Preview of row ${previewRow + 1}`}
                      className="mx-auto max-h-40 w-auto rounded border border-border bg-white"
                    />
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Rendering preview…
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" size="sm" onClick={() => validateAll()}>
                    Validate all rows
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="batch-skip" className="text-xs">
                      Skip invalid rows
                    </Label>
                    <Switch
                      id="batch-skip"
                      checked={skipInvalid}
                      onCheckedChange={setSkipInvalid}
                    />
                  </div>
                </div>

                {issues !== null && (
                  <div className="text-xs">
                    {issues.length === 0 ? (
                      <p className="text-success-foreground">
                        All {csv.rows.length} rows validate cleanly.
                      </p>
                    ) : (
                      <div className="max-h-24 space-y-0.5 overflow-y-auto">
                        {issues.slice(0, 20).map((issue, i) => (
                          <p
                            key={i}
                            className={
                              issue.severity === "error"
                                ? "text-destructive"
                                : "text-warning-foreground"
                            }
                          >
                            Row {issue.rowIndex + 1}: “{issue.objectName}” —{" "}
                            {issue.message}
                          </p>
                        ))}
                        {issues.length > 20 && <p>…and {issues.length - 20} more</p>}
                      </div>
                    )}
                  </div>
                )}

                {progress && (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rendering {progress.done}/{progress.total}
                      {progress.estimatedZipBytes &&
                      progress.estimatedZipBytes > WARN_ZIP_BYTES
                        ? ` — estimated ${(progress.estimatedZipBytes / 1024 / 1024).toFixed(0)} MB; consider 300 DPI or fewer rows`
                        : ""}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {progress ? (
            <Button
              variant="outline"
              onClick={() => abortRef.current?.abort()}
            >
              Cancel export
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {!gated && tokens.length > 0 && (
                <Button
                  onClick={() => void runExport()}
                  disabled={!csv || csv.rows.length === 0}
                >
                  <Table2 className="size-4" aria-hidden />
                  Export {csv ? `${csv.rows.length} labels` : "batch"}
                  {errorCount > 0 && skipInvalid ? ` (skip ${errorCount} invalid)` : ""}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
