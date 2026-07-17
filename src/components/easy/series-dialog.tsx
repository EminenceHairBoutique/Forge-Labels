"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import { ensureEasyFonts } from "@/lib/easy/fields";
import { getEasyTemplate } from "@/lib/easy/templates";
import {
  buildSeriesVariant,
  parseSeriesCsv,
  SERIES_MAX_ROWS,
  type SeriesRow,
} from "@/lib/easy/series";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { getStorageAdapter } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";

/**
 * §14 — create a complete product series from one design. A small
 * spreadsheet (or a CSV import) where each row becomes a matching label:
 * same brand, typography, material, layout, dimensions, and notice —
 * only the product fields change, with optional amount color coding.
 */

type EditRow = SeriesRow & { key: number };

const emptyRow = (key: number): EditRow => ({ key, productName: "" });

export function SeriesDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<EditRow[]>([emptyRow(1), emptyRow(2), emptyRow(3)]);
  const [colorByAmount, setColorByAmount] = React.useState(true);
  const [moreColumns, setMoreColumns] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const nextKey = React.useRef(4);

  const filled = rows.filter((r) => r.productName.trim());

  const setCell = (key: number, field: keyof SeriesRow, value: string) => {
    setRows((current) =>
      current.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  };

  const importCsv = async (file: File) => {
    const result = parseSeriesCsv(await file.text());
    for (const error of result.errors) toast.info("CSV note", error);
    if (result.ignored.length > 0) {
      toast.info(
        "Some columns were skipped",
        `No matching field for: ${result.ignored.join(", ")}.`,
      );
    }
    if (result.rows.length > 0) {
      setRows(result.rows.map((r, i) => ({ ...r, key: i + 1 })));
      nextKey.current = result.rows.length + 1;
      toast.success("Spreadsheet loaded", `${result.rows.length} products ready.`);
    }
  };

  async function create() {
    if (filled.length === 0) return;
    setBusy(true);
    setProgress(0);
    try {
      const template = doc.easy ? getEasyTemplate(doc.easy.templateId) : undefined;
      if (template) await ensureEasyFonts(template, doc.easy?.pairingId);
      const adapter = getStorageAdapter();
      let created = 0;
      for (const row of filled) {
        const variant = buildSeriesVariant(
          doc,
          { ...row, accent: colorByAmount ? "auto" : undefined },
          measureTextHeightMm,
        );
        await adapter.createProject({ name: row.productName.trim(), doc: variant });
        created += 1;
        setProgress(created);
      }
      toast.success(
        "Series created",
        `${created} matching label${created === 1 ? "" : "s"} added to your projects.`,
      );
      onOpenChange(false);
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        "Couldn't finish the series",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a matching series</DialogTitle>
          <DialogDescription>
            One row per product — every label keeps this design&apos;s brand,
            fonts, material, size, and notice.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={colorByAmount}
              onCheckedChange={setColorByAmount}
              aria-label="Color-code by amount"
            />
            Color-code by amount (5 mg blue, 10 mg purple…)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={moreColumns}
              onCheckedChange={setMoreColumns}
              aria-label="Show catalog, retest, QR, and barcode columns"
            />
            More columns
          </label>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden /> Import CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Import a CSV of products"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsv(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[540px] text-xs">
            <thead>
              <tr className="border-b border-border bg-subtle text-left">
                <th className="px-2 py-1.5 font-medium">Compound / product *</th>
                <th className="px-2 py-1.5 font-medium">Short name</th>
                <th className="px-2 py-1.5 font-medium">Amount</th>
                <th className="px-2 py-1.5 font-medium">Unit</th>
                <th className="px-2 py-1.5 font-medium">Lot</th>
                <th className="px-2 py-1.5 font-medium">Batch</th>
                {moreColumns && (
                  <>
                    <th className="px-2 py-1.5 font-medium">Catalog №</th>
                    <th className="px-2 py-1.5 font-medium">Retest</th>
                    <th className="px-2 py-1.5 font-medium">QR link</th>
                    <th className="px-2 py-1.5 font-medium">Barcode</th>
                  </>
                )}
                <th className="w-8" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <Cell value={row.productName} label={`Product for row ${index + 1}`} onChange={(v) => setCell(row.key, "productName", v)} placeholder="e.g. Peptide RC-7" />
                  <Cell value={row.abbreviation ?? ""} label={`Short name for row ${index + 1}`} onChange={(v) => setCell(row.key, "abbreviation", v)} placeholder="RC-7" />
                  <Cell value={row.amount ?? ""} label={`Amount for row ${index + 1}`} onChange={(v) => setCell(row.key, "amount", v)} placeholder="10" narrow />
                  <Cell value={row.unit ?? ""} label={`Unit for row ${index + 1}`} onChange={(v) => setCell(row.key, "unit", v)} placeholder="mg" narrow />
                  <Cell value={row.lot ?? ""} label={`Lot for row ${index + 1}`} onChange={(v) => setCell(row.key, "lot", v)} placeholder="LOT-01" />
                  <Cell value={row.batch ?? ""} label={`Batch for row ${index + 1}`} onChange={(v) => setCell(row.key, "batch", v)} placeholder="B-118" />
                  {moreColumns && (
                    <>
                      <Cell value={row.catalog ?? ""} label={`Catalog number for row ${index + 1}`} onChange={(v) => setCell(row.key, "catalog", v)} placeholder="CAT-01" />
                      <Cell value={row.retest ?? ""} label={`Retest date for row ${index + 1}`} onChange={(v) => setCell(row.key, "retest", v)} placeholder="01/2027" />
                      <Cell value={row.qr ?? ""} label={`QR link for row ${index + 1}`} onChange={(v) => setCell(row.key, "qr", v)} placeholder="https://…" />
                      <Cell value={row.barcode ?? ""} label={`Barcode for row ${index + 1}`} onChange={(v) => setCell(row.key, "barcode", v)} placeholder="0001" />
                    </>
                  )}
                  <td className="px-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={rows.length >= SERIES_MAX_ROWS}
            onClick={() => setRows((r) => [...r, emptyRow(nextKey.current++)])}
          >
            <Plus className="size-3.5" aria-hidden /> Add row
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={filled.length === 0}
            onClick={() => void create()}
          >
            {busy
              ? `Creating ${progress}/${filled.length}…`
              : `Create ${filled.length || ""} matching label${filled.length === 1 ? "" : "s"}`}
          </Button>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Rows only change what you fill in — leave a cell empty and the label
          keeps the original value. CSV columns are matched by name
          (Compound, Amount, Unit, Lot, Batch, Catalog, Retest, QR, Barcode).
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Cell({
  value,
  label,
  onChange,
  placeholder,
  narrow,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  narrow?: boolean;
}) {
  return (
    <td className="px-1 py-1">
      <Input
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={narrow ? "h-7 w-14 px-1.5 text-xs" : "h-7 min-w-24 px-1.5 text-xs"}
      />
    </td>
  );
}
