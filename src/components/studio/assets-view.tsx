"use client";

import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { getStorageAdapter } from "@/lib/storage";
import type { AssetRecord } from "@/lib/storage/types";
import { prepareUpload, UploadError, UPLOAD_ACCEPT_ATTR } from "@/lib/images/upload";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AssetWithUrl extends AssetRecord {
  url: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetsView() {
  const [assets, setAssets] = React.useState<AssetWithUrl[] | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AssetRecord | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const urlsRef = React.useRef<string[]>([]);
  const [reloadTick, setReloadTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const adapter = getStorageAdapter();
      const list = await adapter.listAssets();
      const withUrls: AssetWithUrl[] = await Promise.all(
        list.map(async (asset) => {
          const blob = await adapter.getAssetBlob(asset.id);
          const url = blob ? URL.createObjectURL(blob) : null;
          if (url) urlsRef.current.push(url);
          return { ...asset, url };
        }),
      );
      if (alive) setAssets(withUrls);
    })().catch(() => {
      if (alive) setAssets([]);
    });
    return () => {
      alive = false;
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current = [];
    };
  }, [reloadTick]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await prepareUpload(file);
      toast.success("Asset uploaded", file.name);
      setReloadTick((t) => t + 1);
    } catch (err) {
      toast.error(
        "Upload failed",
        err instanceof UploadError ? err.message : undefined,
      );
    }
  };

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await getStorageAdapter().deleteAsset(deleteTarget.id);
      toast.success("Asset deleted");
      setDeleteTarget(null);
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Uploaded logos and images, reusable across projects.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={UPLOAD_ACCEPT_ATTR}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => void onUpload(e)}
        />
        <Button onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-4" aria-hidden />
          Upload image
        </Button>
      </div>

      {assets === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <ImagePlus className="size-8 text-muted-foreground/50" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">
            No assets yet. Upload logos or product photos here, or directly
            from the editor&apos;s image tool.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="group relative overflow-hidden rounded-lg border border-border bg-surface"
            >
              <div className="flex aspect-square items-center justify-center bg-canvas-backdrop p-2">
                {asset.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob URL
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Unavailable</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{asset.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {asset.width && asset.height
                      ? `${asset.width}×${asset.height} · `
                      : ""}
                    {formatBytes(asset.byteSize)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 shrink-0 text-destructive opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Delete ${asset.name}`}
                  onClick={() => setDeleteTarget(asset)}
                >
                  <Trash2 className="size-3" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Projects using this image will show an empty placeholder where it
              was placed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={busy} onClick={() => void confirmDelete()}>
              Delete asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
