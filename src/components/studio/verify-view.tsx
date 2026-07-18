"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, FileUp, Plus, ShieldCheck, Trash2 } from "lucide-react";
import {
  attachCoa,
  createBatchRecord,
  deleteBatchRecord,
  listBatchRecords,
  setBatchPublished,
  verifyUrl,
} from "@/lib/verify";
import { MAX_FIELD_ROWS, type BatchFieldRow, type BatchRecord } from "@/lib/verify-core";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";

/**
 * Batch verification pages: publish a per-batch record (product, batch
 * code, your own field rows, your intended-use notice, optional COA PDF)
 * and point the label's QR at the tokened URL. Everything shown on the
 * public page is the owner's text verbatim — this UI never suggests or
 * fills scientific values, and the page itself says Forge Labels doesn't
 * verify contents. Cloud mode only.
 */

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          Verification pages
        </h1>
        <p className="text-sm text-muted-foreground">
          Hosted batch records your labels’ QR codes can link to.
        </p>
      </header>
      {children}
    </div>
  );
}

export function VerifyView() {
  const status = useAuthStore((s) => s.status);
  // The editor's "host a verification page" link lands here with the
  // label's fields prefilled — that also opens the create card.
  const searchParams = useSearchParams();
  const prefill = {
    product: searchParams.get("product") ?? "",
    batch: searchParams.get("batch") ?? "",
    notice: searchParams.get("notice") ?? "",
  };
  const [records, setRecords] = React.useState<BatchRecord[] | null>(null);
  const [creating, setCreating] = React.useState(
    Boolean(prefill.product || prefill.batch || prefill.notice),
  );
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (status !== "signed-in") return;
    let alive = true;
    listBatchRecords()
      .then((rows) => {
        if (alive) setRecords(rows);
      })
      .catch((err: unknown) => {
        if (alive) {
          setRecords([]);
          toast.error(
            "Couldn't load verification pages",
            err instanceof Error ? err.message : undefined,
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [status, tick]);

  if (status === "local") {
    return (
      <Gate>
        <Callout variant="info" title="Verification pages require cloud mode">
          Hosted batch records live in Postgres and activate once Supabase is
          configured — see <code>docs/SETUP.md</code>. In local demo mode the
          QR code can still point at any URL you already host.
        </Callout>
      </Gate>
    );
  }
  if (status === "loading") {
    return (
      <Gate>
        <Skeleton className="h-40" />
      </Gate>
    );
  }
  if (status === "signed-out") {
    return (
      <Gate>
        <Callout variant="info" title="Sign in to publish verification pages">
          <Link href="/login" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to create hosted batch records for your labels.
        </Callout>
      </Gate>
    );
  }

  return (
    <Gate>
      <Callout variant="info">
        Pages show exactly what you type — nothing is suggested, derived, or
        certified. Each page carries a notice that Forge Labels does not
        verify product contents.
      </Callout>

      <CreateCard
        open={creating}
        prefill={prefill}
        onOpenChange={setCreating}
        onCreated={() => {
          setCreating(false);
          setTick((t) => t + 1);
        }}
      />

      {records === null ? (
        <Skeleton className="h-40" />
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pages yet — publish your first batch record above.
        </p>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              onChanged={() => setTick((t) => t + 1)}
            />
          ))}
        </ul>
      )}
    </Gate>
  );
}

function CreateCard({
  open,
  prefill,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  prefill: { product: string; batch: string; notice: string };
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [productName, setProductName] = React.useState(prefill.product);
  const [batchCode, setBatchCode] = React.useState(prefill.batch);
  const [notice, setNotice] = React.useState(prefill.notice);
  const [rows, setRows] = React.useState<BatchFieldRow[]>([{ label: "", value: "" }]);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!productName.trim() || !batchCode.trim()) {
      toast.error("Product name and batch code are required");
      return;
    }
    setBusy(true);
    try {
      await createBatchRecord({
        productName,
        batchCode,
        fields: rows,
        notice: notice || undefined,
      });
      toast.success("Verification page published");
      setProductName("");
      setBatchCode("");
      setNotice("");
      setRows([{ label: "", value: "" }]);
      onCreated();
    } catch (err) {
      toast.error(
        "Couldn't publish the page",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => onOpenChange(true)}>
        <Plus className="size-4" aria-hidden />
        New verification page
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New batch record</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="verify-product">Product name</Label>
            <Input
              id="verify-product"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="verify-batch">Batch / lot code</Label>
            <Input
              id="verify-batch"
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Details (shown exactly as typed)</Label>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[38%_1fr_auto] gap-2">
              <Input
                aria-label={`Field ${i + 1} label`}
                placeholder="e.g. Storage"
                value={row.label}
                onChange={(e) =>
                  setRows((r) => r.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
              />
              <Input
                aria-label={`Field ${i + 1} value`}
                placeholder="Your wording"
                value={row.value}
                onChange={(e) =>
                  setRows((r) => r.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove field ${i + 1}`}
                onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          {rows.length < MAX_FIELD_ROWS && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows((r) => [...r, { label: "", value: "" }])}
            >
              <Plus className="size-3.5" aria-hidden /> Add a row
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="verify-notice">Intended-use notice (optional)</Label>
          <Textarea
            id="verify-notice"
            rows={2}
            placeholder="e.g. For laboratory research use only. Not for human or veterinary use."
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button loading={busy} onClick={() => void submit()}>
            Publish page
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordCard({
  record,
  onChanged,
}: {
  record: BatchRecord;
  onChanged: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(verifyUrl(record.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      await attachCoa(record, file);
      toast.success("COA attached", "Its SHA-256 fingerprint shows on the page.");
      onChanged();
    } catch (err) {
      toast.error("COA upload failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{record.productName}</span>
            <Badge variant="outline">Batch {record.batchCode}</Badge>
            {record.coaSha256 && <Badge variant="outline">COA attached</Badge>}
            {!record.published && <Badge variant="outline">Unpublished</Badge>}
            <span className="flex-1" />
            <label className="flex items-center gap-1.5 text-xs">
              <Switch
                checked={record.published}
                aria-label={`${record.productName} page published`}
                onCheckedChange={(published) => {
                  void setBatchPublished(record.id, published)
                    .then(onChanged)
                    .catch((err: unknown) =>
                      toast.error(
                        "Couldn't update",
                        err instanceof Error ? err.message : undefined,
                      ),
                    );
                }}
              />
              Live
            </label>
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">
            /verify/{record.token}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copy()}>
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              Copy link
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="size-3.5" aria-hidden />
              {record.coaSha256 ? "Replace COA" : "Attach COA (PDF)"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              aria-label={`Attach a COA PDF to ${record.productName}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                if (!confirm("Delete this verification page? Its link stops working.")) return;
                void deleteBatchRecord(record)
                  .then(onChanged)
                  .catch((err: unknown) =>
                    toast.error(
                      "Couldn't delete",
                      err instanceof Error ? err.message : undefined,
                    ),
                  );
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
