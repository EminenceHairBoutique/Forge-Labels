"use client";

import * as React from "react";
import { Download } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import { exportRaster } from "@/lib/export/raster";
import { createSingleLabelPdf } from "@/lib/export/pdf";
import { getStorageAdapter } from "@/lib/storage";
import { formatMm } from "@/lib/geometry/units";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { PreflightPanel } from "./preflight-panel";

type ExportFormat = "png-sticker" | "png-print" | "jpg" | "pdf" | "svg" | "zip";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  "png-sticker": "PNG — die-cut sticker (transparent-capable)",
  "png-print": "PNG — print artwork with bleed",
  jpg: "JPG — flattened preview",
  pdf: "PDF — print-ready (TrimBox + BleedBox)",
  svg: "SVG — vector (text outlined)",
  zip: "ZIP — every format bundled",
};

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replaceAll(/[^\w\- ]+/g, "")
      .replaceAll(/\s+/g, "-")
      .slice(0, 60) || "label"
  );
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

interface ExportDialogProps {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ doc, open, onOpenChange }: ExportDialogProps) {
  const [format, setFormat] = React.useState<ExportFormat>("pdf");
  const [dpi, setDpi] = React.useState<300 | 600>(300);
  const [cropMarks, setCropMarks] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const projectName = useProjectSessionStore((s) => s.projectName);
  const projectId = useProjectSessionStore((s) => s.projectId);

  const sizeLabel = `${formatMm(doc.label.widthMm, "mm", { suffix: false })}×${formatMm(doc.label.heightMm, "mm")}`;

  async function runExport() {
    setBusy(true);
    try {
      const base = `${sanitizeFileName(projectName)}-${doc.label.widthMm.toFixed(0)}x${doc.label.heightMm.toFixed(0)}mm`;
      let fileName: string;
      let blob: Blob;
      let kind: "png" | "jpg" | "pdf" | "svg" | "zip";

      if (format === "svg") {
        const { exportSvg } = await import("@/lib/export/svg");
        const result = await exportSvg(doc);
        if (result.warnings.length > 0) {
          toast.info("SVG export notes", result.warnings.join(" • "));
        }
        blob = new Blob([result.svg], { type: "image/svg+xml" });
        fileName = `${base}.svg`;
        kind = "svg";
      } else if (format === "zip") {
        const [{ zipSync, strToU8 }, svgModule] = await Promise.all([
          import("fflate"),
          import("@/lib/export/svg"),
        ]);
        const sticker = await exportRaster(doc, { dpi: 300, mode: "sticker", format: "png" });
        const printPng = await exportRaster(doc, { dpi: 600, mode: "print", format: "png" });
        const pdfBytes = await createSingleLabelPdf({
          widthMm: doc.label.widthMm,
          heightMm: doc.label.heightMm,
          bleedMm: doc.label.bleedMm,
          pngBytes: new Uint8Array(await printPng.blob.arrayBuffer()),
          cropMarks: true,
          title: projectName,
        });
        const svgResult = await svgModule.exportSvg(doc);
        const zipped = zipSync({
          [`${base}-300dpi.png`]: new Uint8Array(await sticker.blob.arrayBuffer()),
          [`${base}-print-600dpi.png`]: new Uint8Array(await printPng.blob.arrayBuffer()),
          [`${base}-print.pdf`]: pdfBytes,
          [`${base}.svg`]: strToU8(svgResult.svg),
          "README.txt": strToU8(
            `Forge Labels export package\n\n` +
              `Finished label size: ${doc.label.widthMm.toFixed(2)} × ${doc.label.heightMm.toFixed(2)} mm (bleed ${doc.label.bleedMm} mm)\n\n` +
              `- ${base}-300dpi.png: die-cut sticker raster (trim size)\n` +
              `- ${base}-print-600dpi.png: print artwork including bleed\n` +
              `- ${base}-print.pdf: print-ready PDF (TrimBox/BleedBox + crop marks)\n` +
              `- ${base}.svg: vector artwork, text outlined\n\n` +
              `Print at 100% scale and verify dimensions against your vial before a full run.\n`,
          ),
        });
        blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
        fileName = `${base}-package.zip`;
        kind = "zip";
      } else if (format === "pdf") {
        // 600 DPI raster inside the PDF regardless of the preview DPI choice
        // keeps small text crisp; physical size comes from the PDF boxes.
        const raster = await exportRaster(doc, {
          dpi: Math.max(dpi, 600),
          mode: "print",
          format: "png",
        });
        const pngBytes = new Uint8Array(await raster.blob.arrayBuffer());
        const pdfBytes = await createSingleLabelPdf({
          widthMm: doc.label.widthMm,
          heightMm: doc.label.heightMm,
          bleedMm: doc.label.bleedMm,
          pngBytes,
          cropMarks,
          title: projectName,
        });
        blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        fileName = `${base}-print.pdf`;
        kind = "pdf";
      } else if (format === "jpg") {
        const raster = await exportRaster(doc, { dpi, mode: "sticker", format: "jpg" });
        blob = raster.blob;
        fileName = `${base}-${dpi}dpi.jpg`;
        kind = "jpg";
      } else {
        const raster = await exportRaster(doc, {
          dpi,
          mode: format === "png-print" ? "print" : "sticker",
          format: "png",
        });
        blob = raster.blob;
        fileName = `${base}-${format === "png-print" ? "bleed-" : ""}${dpi}dpi.png`;
        kind = "png";
      }

      downloadBlob(blob, fileName);
      await getStorageAdapter().recordExport({
        projectId,
        projectName,
        kind,
        fileName,
        byteSize: blob.size,
        dpi: format === "pdf" ? 600 : dpi,
      });
      toast.success("Export ready", fileName);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        "Export failed",
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export label</DialogTitle>
          <DialogDescription>
            Finished size {sizeLabel} · bleed {doc.label.bleedMm} mm
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="export-format">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger id="export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {format !== "pdf" && (
            <div className="space-y-1.5">
              <Label htmlFor="export-dpi">Resolution</Label>
              <Select
                value={String(dpi)}
                onValueChange={(v) => setDpi(Number(v) as 300 | 600)}
              >
                <SelectTrigger id="export-dpi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">300 DPI — standard print</SelectItem>
                  <SelectItem value="600">600 DPI — fine detail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {format === "pdf" && (
            <div className="flex items-center justify-between">
              <Label htmlFor="export-marks">Crop marks</Label>
              <Switch id="export-marks" checked={cropMarks} onCheckedChange={setCropMarks} />
            </div>
          )}

          <PreflightPanel doc={doc} onJump={() => onOpenChange(false)} />

          <Callout variant="info">
            Print at 100% scale (never “fit to page”) and test one label on
            your vial before a full run. On-screen colors and simulated
            finishes can differ from printed output.
          </Callout>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void runExport()} loading={busy}>
            <Download className="size-4" aria-hidden />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
