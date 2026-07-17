"use client";

import * as React from "react";
import { zipSync, strToU8 } from "fflate";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Download,
  HelpCircle,
  Home,
  Info,
  Printer,
} from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import { scanCompliance, findingSlotLabel, type ComplianceFinding } from "@/lib/easy/compliance";
import { readEasyState } from "@/lib/easy/fields";
import { NOTICE_REMINDER } from "@/lib/easy/notices";
import type { SlotId } from "@/lib/easy/slots";
import { exportRaster } from "@/lib/export/raster";
import { createSingleLabelPdf } from "@/lib/export/pdf";
import { createSheetPdf } from "@/lib/export/sheet-pdf";
import { computeImposition } from "@/lib/print/imposition";
import { runPreflight } from "@/lib/preflight/rules";
import { toPlainIssues } from "@/lib/easy/plain-preflight";
import { buildSpecSheet } from "@/lib/easy/spec-sheet";
import { applyEasyChange } from "@/lib/easy/fields";
import { getStorageAdapter } from "@/lib/storage";
import { useProjectSessionStore } from "@/stores/project-session-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

/**
 * §10 — the beginner print experience. One question ("How will you use
 * your label?"), plain-language checks with one-click fixes, and the
 * right file generated with the right settings — bleed, DPI, crop marks,
 * and the printer spec handled automatically. The technical export dialog
 * stays one click away behind "Advanced print options".
 */

type Mode = "home" | "pro" | "png" | "unsure";

function downloadBlob(blob: Blob, fileName: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function slug(name: string): string {
  return name.replaceAll(/\s+/g, "-").toLowerCase() || "label";
}

export function ExportWizard({
  doc,
  open,
  onOpenChange,
  onAdvanced,
}: {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdvanced: () => void;
}) {
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [paper, setPaper] = React.useState<"letter" | "a4">("letter");
  const [copies, setCopies] = React.useState(12);
  const [cutMyself, setCutMyself] = React.useState(true);
  const projectName = useProjectSessionStore((s) => s.projectName);
  const projectId = useProjectSessionStore((s) => s.projectId);

  const plainIssues = React.useMemo(
    () => (open ? toPlainIssues(runPreflight(doc), doc) : []),
    [doc, open],
  );

  // §7/§29 review gate: the research-use notice must be read before export,
  // and flagged wording must be acknowledged (recorded on the project —
  // nothing is ever deleted or reworded automatically).
  const review = React.useMemo(() => {
    if (!open) return null;
    const state = readEasyState(doc);
    if (!state) return null;
    const onLabel: Partial<Record<SlotId, string>> = {};
    for (const slot of state.enabled) {
      const value = state.fields[slot];
      if (value?.trim()) onLabel[slot] = value;
    }
    const acked = new Set(
      (state.meta.complianceAck ?? []).map((a) => `${a.slot}|${a.phrase}`),
    );
    const findings = scanCompliance(onLabel).filter(
      (f) => !acked.has(`${f.slot}|${f.phrase}`),
    );
    const noticeText = state.enabled.has("notice") ? state.fields.notice?.trim() : undefined;
    const noticeNeedsReview = Boolean(noticeText) && !state.meta.noticeReviewedAt;
    return { findings, noticeText, noticeNeedsReview };
  }, [doc, open]);

  const needsReview = Boolean(
    review && (review.noticeNeedsReview || review.findings.length > 0),
  );

  const confirmReview = () => {
    const now = Date.now();
    void applyEasyChange({
      ...(review?.noticeNeedsReview ? { noticeReviewed: now } : {}),
      ...(review && review.findings.length > 0
        ? {
            acknowledge: review.findings.map((f: ComplianceFinding) => ({
              slot: f.slot,
              phrase: f.phrase,
              at: now,
            })),
          }
        : {}),
    });
  };

  const record = async (kind: "png" | "pdf" | "sheet-pdf" | "zip", fileName: string, byteSize: number, dpi: number | null) => {
    await getStorageAdapter().recordExport({
      projectId,
      projectName,
      kind,
      fileName,
      byteSize,
      dpi,
    });
  };

  async function generateHomeSheet() {
    setBusy(true);
    try {
      const page = paper === "letter" ? { w: 215.9, h: 279.4 } : { w: 210, h: 297 };
      const imposition = computeImposition({
        pageWidthMm: page.w,
        pageHeightMm: page.h,
        labelWidthMm: doc.label.widthMm,
        labelHeightMm: doc.label.heightMm,
        bleedMm: doc.label.bleedMm,
        marginMm: 10,
        spacingXMm: 3,
        spacingYMm: 3,
        offsetXMm: 0,
        offsetYMm: 0,
        copies,
        startRow: 0,
        startCol: 0,
      });
      if (imposition.perPage === 0) {
        toast.error("The label doesn't fit this paper size");
        return;
      }
      const raster = await exportRaster(doc, { dpi: 600, mode: "print", format: "png" });
      const pdfBytes = await createSheetPdf({
        pageWidthMm: page.w,
        pageHeightMm: page.h,
        imposition,
        labelPngBytes: new Uint8Array(await raster.blob.arrayBuffer()),
        labelWidthMm: doc.label.widthMm,
        labelHeightMm: doc.label.heightMm,
        bleedMm: doc.label.bleedMm,
        cutLines: cutMyself,
        cropMarks: false,
        title: `${projectName} — sheet`,
      });
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const fileName = `${slug(projectName)}-print-sheet.pdf`;
      downloadBlob(blob, fileName);
      await record("sheet-pdf", fileName, blob.size, 600);
      toast.success(
        "Print sheet ready",
        `${imposition.placedCount} labels per ${copies > imposition.perPage ? "pages" : "page"} — print at 100% scale (no “fit to page”).`,
      );
    } catch (err) {
      toast.error("Couldn't make the sheet", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function generateProPack() {
    setBusy(true);
    try {
      const raster = await exportRaster(doc, { dpi: 600, mode: "print", format: "png" });
      const pdfBytes = await createSingleLabelPdf({
        widthMm: doc.label.widthMm,
        heightMm: doc.label.heightMm,
        bleedMm: doc.label.bleedMm,
        pngBytes: new Uint8Array(await raster.blob.arrayBuffer()),
        cropMarks: true,
        title: projectName,
      });
      const spec = buildSpecSheet(doc, projectName);
      const zipped = zipSync({
        [`${slug(projectName)}-print-ready.pdf`]: pdfBytes,
        "specification.txt": strToU8(spec),
      });
      const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
      const fileName = `${slug(projectName)}-for-printer.zip`;
      downloadBlob(blob, fileName);
      await record("zip", fileName, blob.size, 600);
      toast.success(
        "Printer package ready",
        "Send the whole ZIP — it includes the print-ready PDF and the specification sheet.",
      );
    } catch (err) {
      toast.error("Couldn't build the package", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function generatePng() {
    setBusy(true);
    try {
      const raster = await exportRaster(doc, { dpi: 300, mode: "sticker", format: "png" });
      const fileName = `${slug(projectName)}.png`;
      downloadBlob(raster.blob, fileName);
      await record("png", fileName, raster.blob.size, 300);
      toast.success("Design downloaded");
    } catch (err) {
      toast.error("Download failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function copySpec() {
    try {
      await navigator.clipboard.writeText(buildSpecSheet(doc, projectName));
      toast.success("Specification copied", "Paste it into an email to your printer.");
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  const close = (next: boolean) => {
    if (!next) setMode(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === null && "How will you use your label?"}
            {mode === "home" && "Print at home"}
            {mode === "pro" && "Send to a professional printer"}
            {mode === "png" && "Download the design"}
            {mode === "unsure" && "Not sure? Here's the safe choice"}
          </DialogTitle>
          {mode === null && (
            <DialogDescription>
              We&apos;ll set up sizing, margins, and print details automatically.
            </DialogDescription>
          )}
        </DialogHeader>

        {plainIssues.length > 0 && mode === null && (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-subtle p-2.5">
            {plainIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {issue.severity === "error" ? (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
                ) : issue.severity === "warning" ? (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" aria-hidden />
                ) : (
                  <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                )}
                <span className="flex-1">{issue.message}</span>
                {issue.fix && (
                  <button
                    type="button"
                    className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => void applyEasyChange(issue.fix!.change)}
                  >
                    {issue.fix.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {mode === null && needsReview && review && (
          <div className="space-y-3 rounded-xl border border-warning bg-warning/10 p-3">
            <p className="text-sm font-medium">Before you print — a quick review</p>
            {review.noticeNeedsReview && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Your label carries this notice:
                </p>
                <p className="rounded-md bg-surface px-2.5 py-1.5 text-xs font-semibold tracking-wide">
                  {review.noticeText}
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {NOTICE_REMINDER}
                </p>
              </div>
            )}
            {review.findings.length > 0 && (
              <ul className="space-y-1.5">
                {review.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle
                      className="mt-0.5 size-3.5 shrink-0 text-warning-foreground"
                      aria-hidden
                    />
                    <span>
                      <span className="font-medium">{findingSlotLabel(f)}</span> contains
                      “{f.phrase}” ({f.excerpt}). {f.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              Nothing was changed or removed — your wording is yours. Forge
              Labels is a design tool and doesn&apos;t provide legal or
              regulatory review.
            </p>
            <Button size="sm" onClick={confirmReview}>
              I&apos;ve reviewed this — continue
            </Button>
          </div>
        )}

        {mode === null && !needsReview && (
          <div className="grid gap-2">
            <ModeCard
              icon={Home}
              title="Print at home"
              body="A ready-to-print sheet for your own printer."
              onClick={() => setMode("home")}
            />
            <ModeCard
              icon={Building2}
              title="Send to a professional printer"
              body="Print-ready PDF plus a specification sheet, zipped."
              onClick={() => setMode("pro")}
            />
            <ModeCard
              icon={Download}
              title="Download the design only"
              body="A high-quality PNG image of the label."
              onClick={() => setMode("png")}
            />
            <ModeCard
              icon={HelpCircle}
              title="I'm not sure"
              body="We'll recommend the safest option."
              onClick={() => setMode("unsure")}
            />
            <button
              type="button"
              onClick={() => {
                close(false);
                onAdvanced();
              }}
              className="mt-1 text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Advanced print options (all formats, DPI, separations…)
            </button>
          </div>
        )}

        {mode === "home" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label id="paper-label">What paper size are you using?</Label>
              <div role="group" aria-labelledby="paper-label" className="grid grid-cols-2 gap-2">
                <ChoiceButton active={paper === "letter"} onClick={() => setPaper("letter")}>
                  US Letter (8.5 × 11″)
                </ChoiceButton>
                <ChoiceButton active={paper === "a4"} onClick={() => setPaper("a4")}>
                  A4
                </ChoiceButton>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label id="cut-label">Will you cut the labels yourself?</Label>
              <div role="group" aria-labelledby="cut-label" className="grid grid-cols-2 gap-2">
                <ChoiceButton active={cutMyself} onClick={() => setCutMyself(true)}>
                  Yes — add cutting guides
                </ChoiceButton>
                <ChoiceButton active={!cutMyself} onClick={() => setCutMyself(false)}>
                  Precut label sheets
                </ChoiceButton>
              </div>
              {!cutMyself && (
                <p className="text-xs text-muted-foreground">
                  Precut sheets need positions that match your sheet brand — the
                  Advanced print options let you adjust margins and spacing
                  exactly.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="copies-input">How many labels do you need?</Label>
              <Input
                id="copies-input"
                type="number"
                min={1}
                max={500}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="w-28"
              />
            </div>
            <WizardActions
              busy={busy}
              onBack={() => setMode(null)}
              onGo={() => void generateHomeSheet()}
              goLabel="Make my print sheet"
            />
            <p className="text-xs text-muted-foreground">
              Print at 100% scale (never “fit to page”) so the labels come out
              at exactly the right size.
            </p>
          </div>
        )}

        {mode === "pro" && (
          <div className="space-y-4">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {[
                "Print-ready PDF at exact physical size",
                "Extra print area and trim marks included",
                "A specification sheet with size, material, and finish notes",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <WizardActions
              busy={busy}
              onBack={() => setMode(null)}
              onGo={() => void generateProPack()}
              goLabel="Download printer package"
            />
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => void copySpec()}>
              <Copy className="size-3.5" aria-hidden />
              Copy the specification as text
            </Button>
          </div>
        )}

        {mode === "png" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A sharp PNG of the finished label — great for sharing, shops, or
              mockups. (Printers should get the printer package instead.)
            </p>
            <WizardActions
              busy={busy}
              onBack={() => setMode(null)}
              onGo={() => void generatePng()}
              goLabel="Download PNG"
            />
          </div>
        )}

        {mode === "unsure" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The safest choice is the <strong>professional printer package</strong>:
              it contains everything any print shop needs, and it also prints
              fine at home at 100% scale. You can always come back for the
              home-print sheet.
            </p>
            <WizardActions
              busy={busy}
              onBack={() => setMode(null)}
              onGo={() => void generateProPack()}
              goLabel="Download printer package"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: typeof Printer;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border-2 border-border bg-surface p-3.5 text-left transition-colors hover:border-primary/50"
    >
      <Icon className="size-5 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border-2 px-3 py-2 text-sm transition-colors",
        active ? "border-primary bg-primary-subtle/40" : "border-border hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

function WizardActions({
  busy,
  onBack,
  onGo,
  goLabel,
}: {
  busy: boolean;
  onBack: () => void;
  onGo: () => void;
  goLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </Button>
      <Button onClick={onGo} loading={busy}>
        {goLabel}
      </Button>
    </div>
  );
}
