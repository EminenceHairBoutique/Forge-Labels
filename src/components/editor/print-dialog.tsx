"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import { exportRaster } from "@/lib/export/raster";
import { createCalibrationPdf, createSheetPdf } from "@/lib/export/sheet-pdf";
import {
  computeImposition,
  PAGE_SIZES,
  type ImpositionInput,
} from "@/lib/print/imposition";
import { getStorageAdapter } from "@/lib/storage";
import { useProjectSessionStore } from "@/stores/project-session-store";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { NumberField } from "./fields/dimension-field";

/** Persisted print preferences (per browser, like a printer driver). */
interface PrintSettings {
  pageSizeId: string;
  landscape: boolean;
  customWidthMm: number;
  customHeightMm: number;
  marginMm: number;
  spacingMm: number;
  offsetXMm: number;
  offsetYMm: number;
  cutLines: boolean;
  cropMarks: boolean;
}

const DEFAULT_SETTINGS: PrintSettings = {
  pageSizeId: "letter",
  landscape: false,
  customWidthMm: 210,
  customHeightMm: 297,
  marginMm: 10,
  spacingMm: 3,
  offsetXMm: 0,
  offsetYMm: 0,
  cutLines: true,
  cropMarks: false,
};

const SETTINGS_KEY = "fl-print-settings";

function loadSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PrintSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

interface PrintDialogProps {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintDialog({ doc, open, onOpenChange }: PrintDialogProps) {
  const [settings, setSettings] = React.useState<PrintSettings>(DEFAULT_SETTINGS);
  const [copies, setCopies] = React.useState(12);
  const [startRow, setStartRow] = React.useState(0);
  const [startCol, setStartCol] = React.useState(0);
  const [busy, setBusy] = React.useState<"sheet" | "calibration" | null>(null);
  const projectName = useProjectSessionStore((s) => s.projectName);
  const projectId = useProjectSessionStore((s) => s.projectId);

  // Load persisted printer settings when the dialog opens.
  const [hydrated, setHydrated] = React.useState(false);
  if (open && !hydrated) {
    setHydrated(true);
    setSettings(loadSettings());
  }
  if (!open && hydrated) {
    setHydrated(false);
  }

  const update = (patch: Partial<PrintSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Persistence is best-effort.
      }
      return next;
    });
  };

  const pageDef = PAGE_SIZES.find((p) => p.id === settings.pageSizeId);
  const baseW = pageDef?.widthMm ?? settings.customWidthMm;
  const baseH = pageDef?.heightMm ?? settings.customHeightMm;
  const pageWidthMm = settings.landscape ? baseH : baseW;
  const pageHeightMm = settings.landscape ? baseW : baseH;

  const input: ImpositionInput = {
    pageWidthMm,
    pageHeightMm,
    labelWidthMm: doc.label.widthMm,
    labelHeightMm: doc.label.heightMm,
    bleedMm: doc.label.bleedMm,
    marginMm: settings.marginMm,
    spacingXMm: settings.spacingMm,
    spacingYMm: settings.spacingMm,
    offsetXMm: settings.offsetXMm,
    offsetYMm: settings.offsetYMm,
    copies,
    startRow,
    startCol,
  };
  const imposition = computeImposition(input);

  async function exportSheet() {
    if (imposition.perPage === 0) return;
    setBusy("sheet");
    try {
      const raster = await exportRaster(doc, { dpi: 600, mode: "print", format: "png" });
      const pdfBytes = await createSheetPdf({
        pageWidthMm,
        pageHeightMm,
        imposition,
        labelPngBytes: new Uint8Array(await raster.blob.arrayBuffer()),
        labelWidthMm: doc.label.widthMm,
        labelHeightMm: doc.label.heightMm,
        bleedMm: doc.label.bleedMm,
        cutLines: settings.cutLines,
        cropMarks: settings.cropMarks,
        title: `${projectName} — sheet`,
      });
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: "application/pdf",
      });
      const fileName = `${projectName.replaceAll(/\s+/g, "-").toLowerCase() || "labels"}-sheet-${imposition.placedCount}up.pdf`;
      downloadBlob(blob, fileName);
      await getStorageAdapter().recordExport({
        projectId,
        projectName,
        kind: "sheet-pdf",
        fileName,
        byteSize: blob.size,
        dpi: 600,
      });
      toast.success("Sheet PDF ready", fileName);
    } catch (err) {
      toast.error("Sheet export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function exportCalibration() {
    setBusy("calibration");
    try {
      const bytes = await createCalibrationPdf(pageWidthMm, pageHeightMm);
      downloadBlob(
        new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        "forge-labels-calibration.pdf",
      );
    } catch (err) {
      toast.error("Calibration export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Print sheet</DialogTitle>
          <DialogDescription>
            Lay out {doc.label.widthMm.toFixed(1)} × {doc.label.heightMm.toFixed(1)} mm
            labels on a page for home or office printing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="print-page" className="text-xs text-muted-foreground">
                  Page size
                </Label>
                <Select
                  value={settings.pageSizeId}
                  onValueChange={(pageSizeId) => update({ pageSizeId })}
                >
                  <SelectTrigger id="print-page" className="h-8">
                    {pageDef?.name ?? "Custom"}
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch
                  id="print-landscape"
                  checked={settings.landscape}
                  onCheckedChange={(landscape) => update({ landscape })}
                />
                <Label htmlFor="print-landscape" className="text-sm">
                  Landscape
                </Label>
              </div>
              {!pageDef && (
                <>
                  <NumberField
                    id="print-custom-w"
                    label="Page width"
                    value={settings.customWidthMm}
                    min={50}
                    max={1000}
                    suffix="mm"
                    onCommit={(customWidthMm) => update({ customWidthMm })}
                  />
                  <NumberField
                    id="print-custom-h"
                    label="Page height"
                    value={settings.customHeightMm}
                    min={50}
                    max={1000}
                    suffix="mm"
                    onCommit={(customHeightMm) => update({ customHeightMm })}
                  />
                </>
              )}
              <NumberField
                id="print-margin"
                label="Page margin"
                value={settings.marginMm}
                min={0}
                max={40}
                step={0.5}
                suffix="mm"
                onCommit={(marginMm) => update({ marginMm })}
              />
              <NumberField
                id="print-spacing"
                label="Label spacing"
                value={settings.spacingMm}
                min={0}
                max={20}
                step={0.5}
                suffix="mm"
                onCommit={(spacingMm) => update({ spacingMm })}
              />
              <NumberField
                id="print-copies"
                label="Copies"
                value={copies}
                min={1}
                max={2000}
                onCommit={(v) => setCopies(Math.round(v))}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  id="print-start-row"
                  label="Start row"
                  value={startRow + 1}
                  min={1}
                  max={Math.max(imposition.rows, 1)}
                  onCommit={(v) => setStartRow(Math.round(v) - 1)}
                />
                <NumberField
                  id="print-start-col"
                  label="Start col"
                  value={startCol + 1}
                  min={1}
                  max={Math.max(imposition.columns, 1)}
                  onCommit={(v) => setStartCol(Math.round(v) - 1)}
                />
              </div>
            </div>

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Printer calibration
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Print the calibration page, measure, and enter your printer&apos;s
                  offset. Saved on this device for all future sheets.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    id="print-offset-x"
                    label="Offset X"
                    value={settings.offsetXMm}
                    min={-20}
                    max={20}
                    step={0.1}
                    suffix="mm"
                    onCommit={(offsetXMm) => update({ offsetXMm })}
                  />
                  <NumberField
                    id="print-offset-y"
                    label="Offset Y"
                    value={settings.offsetYMm}
                    min={-20}
                    max={20}
                    step={0.1}
                    suffix="mm"
                    onCommit={(offsetYMm) => update({ offsetYMm })}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === "calibration"}
                  onClick={() => void exportCalibration()}
                >
                  <Download className="size-3.5" aria-hidden />
                  Calibration page (PDF)
                </Button>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.cutLines}
                  onCheckedChange={(cutLines) => update({ cutLines })}
                  aria-label="Cut lines"
                />
                Cut lines
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.cropMarks}
                  onCheckedChange={(cropMarks) => update({ cropMarks })}
                  aria-label="Crop marks"
                />
                Crop marks
              </label>
            </div>

            {imposition.issues.map((issue) => (
              <Callout key={issue} variant="warning">
                {issue}
              </Callout>
            ))}
          </div>

          {/* Live preview + stats */}
          <div className="space-y-3">
            <SheetPreview
              pageWidthMm={pageWidthMm}
              pageHeightMm={pageHeightMm}
              bleedMm={doc.label.bleedMm}
              imposition={imposition}
            />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Per page</dt>
              <dd className="text-right tabular-nums">
                {imposition.columns} × {imposition.rows} = {imposition.perPage}
              </dd>
              <dt className="text-muted-foreground">Pages</dt>
              <dd className="text-right tabular-nums">{imposition.pageCount}</dd>
              <dt className="text-muted-foreground">Labels placed</dt>
              <dd className="text-right tabular-nums">{imposition.placedCount}</dd>
              <dt className="text-muted-foreground">Page coverage</dt>
              <dd className="text-right tabular-nums">
                {(imposition.usedAreaRatio * 100).toFixed(0)}%
              </dd>
            </dl>
            <Button
              className="w-full"
              disabled={imposition.perPage === 0}
              loading={busy === "sheet"}
              onClick={() => void exportSheet()}
            >
              <Printer className="size-4" aria-hidden />
              Export sheet PDF
            </Button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Print at 100% scale — never “fit to page”. Labels render at 600 DPI
              with bleed included.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SheetPreview({
  pageWidthMm,
  pageHeightMm,
  bleedMm,
  imposition,
}: {
  pageWidthMm: number;
  pageHeightMm: number;
  bleedMm: number;
  imposition: ReturnType<typeof computeImposition>;
}) {
  const firstPage = imposition.pages[0] ?? [];
  return (
    <svg
      viewBox={`0 0 ${pageWidthMm} ${pageHeightMm}`}
      className="w-full rounded-md border border-border bg-surface shadow-xs"
      role="img"
      aria-label={`Sheet preview: ${imposition.perPage} labels per page on a ${pageWidthMm.toFixed(0)} by ${pageHeightMm.toFixed(0)} millimeter page`}
    >
      <rect x="0" y="0" width={pageWidthMm} height={pageHeightMm} fill="white" />
      {firstPage.map((cell) => (
        <g key={`${cell.row}-${cell.col}`}>
          {/* Artwork cell (label + bleed) */}
          <rect
            x={cell.xMm}
            y={cell.yMm}
            width={imposition.cellWidthMm}
            height={imposition.cellHeightMm}
            fill="#ede9fe"
          />
          {/* Trim outline */}
          <rect
            x={cell.xMm + bleedMm}
            y={cell.yMm + bleedMm}
            width={imposition.cellWidthMm - 2 * bleedMm}
            height={imposition.cellHeightMm - 2 * bleedMm}
            fill="#ffffff"
            stroke="#7c6ce0"
            strokeWidth={0.4}
          />
        </g>
      ))}
    </svg>
  );
}
