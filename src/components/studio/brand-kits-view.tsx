"use client";

import * as React from "react";
import { Palette, Plus, Trash2 } from "lucide-react";
import { getStorageAdapter } from "@/lib/storage";
import type { AssetRecord, BrandKitRecord } from "@/lib/storage/types";
import { FONT_FAMILIES } from "@/lib/fonts/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const EMPTY_KIT: Omit<BrandKitRecord, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  colors: ["#1a1a1a", "#4c3d8f", "#d4af5f"],
  fontFamilyIds: ["inter"],
  logoAssetIds: [],
  contact: {},
  standardWarnings: [],
};

export function BrandKitsView() {
  const [kits, setKits] = React.useState<BrandKitRecord[] | null>(null);
  const [assets, setAssets] = React.useState<AssetRecord[]>([]);
  const [assetUrls, setAssetUrls] = React.useState<Map<string, string>>(new Map());
  const [editing, setEditing] = React.useState<
    (Omit<BrandKitRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }) | null
  >(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BrandKitRecord | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reloadTick, setReloadTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    (async () => {
      const adapter = getStorageAdapter();
      const [kitList, assetList] = await Promise.all([
        adapter.listBrandKits(),
        adapter.listAssets(),
      ]);
      const urlMap = new Map<string, string>();
      for (const asset of assetList.filter((a) => a.mimeType.startsWith("image/"))) {
        const blob = await adapter.getAssetBlob(asset.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          urlMap.set(asset.id, url);
        }
      }
      if (alive) {
        setKits(kitList);
        setAssets(assetList);
        setAssetUrls(urlMap);
      }
    })().catch(() => {
      if (alive) setKits([]);
    });
    return () => {
      alive = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [reloadTick]);

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try {
      await getStorageAdapter().saveBrandKit({
        ...editing,
        name: editing.name.trim(),
        colors: editing.colors.filter(Boolean),
        standardWarnings: editing.standardWarnings.filter((w) => w.trim()),
      });
      toast.success("Brand kit saved");
      setEditing(null);
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await getStorageAdapter().deleteBrandKit(deleteTarget.id);
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
          <h1 className="font-display text-2xl font-bold tracking-tight">Brand kits</h1>
          <p className="text-sm text-muted-foreground">
            Colors, fonts, logos, and standard text — one click away inside the
            editor&apos;s Brand tab.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY_KIT })}>
          <Plus className="size-4" aria-hidden />
          New brand kit
        </Button>
      </div>

      {kits === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : kits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Palette className="size-8 text-muted-foreground/50" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">
            Create a kit with your brand colors, fonts, and logo — every
            project can pull from it instantly.
          </p>
          <Button onClick={() => setEditing({ ...EMPTY_KIT })}>
            <Plus className="size-4" aria-hidden />
            New brand kit
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <li
              key={kit.id}
              className="group rounded-xl border border-border bg-surface p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{kit.name}</h3>
                <div className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${kit.name}`}
                    onClick={() => setEditing({ ...kit })}
                  >
                    <Palette className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Delete ${kit.name}`}
                    onClick={() => setDeleteTarget(kit)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                {kit.colors.map((color, i) => (
                  <span
                    key={`${color}-${i}`}
                    className="size-6 rounded-full border border-border"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {kit.fontFamilyIds
                  .map((id) => FONT_FAMILIES.find((f) => f.id === id)?.name ?? id)
                  .join(", ")}
              </p>
              {kit.logoAssetIds.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {kit.logoAssetIds.slice(0, 4).map((id) => {
                    const url = assetUrls.get(id);
                    return url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob URL
                      <img
                        key={id}
                        src={url}
                        alt=""
                        className="size-8 rounded border border-border object-contain"
                      />
                    ) : null;
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Editor dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit brand kit" : "New brand kit"}</DialogTitle>
            <DialogDescription>
              Everything here appears in the editor&apos;s Brand tab.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="kit-name">Name</Label>
                <Input
                  id="kit-name"
                  value={editing.name}
                  maxLength={60}
                  placeholder="e.g. AURELIS core"
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Colors</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {editing.colors.map((color, index) => (
                    <span key={index} className="relative">
                      <input
                        type="color"
                        value={color}
                        aria-label={`Brand color ${index + 1}`}
                        onChange={(e) => {
                          const colors = [...editing.colors];
                          colors[index] = e.target.value;
                          setEditing({ ...editing, colors });
                        }}
                        className="size-9 cursor-pointer rounded-md border border-input bg-surface p-0.5"
                      />
                      <button
                        type="button"
                        aria-label={`Remove color ${index + 1}`}
                        className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground hover:flex focus:flex [span:hover>&]:flex cursor-pointer"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            colors: editing.colors.filter((_, i) => i !== index),
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {editing.colors.length < 10 && (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Add color"
                      onClick={() =>
                        setEditing({ ...editing, colors: [...editing.colors, "#888888"] })
                      }
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Fonts</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {FONT_FAMILIES.map((font) => (
                    <label key={font.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editing.fontFamilyIds.includes(font.id)}
                        onCheckedChange={(on) =>
                          setEditing({
                            ...editing,
                            fontFamilyIds: on
                              ? [...editing.fontFamilyIds, font.id]
                              : editing.fontFamilyIds.filter((id) => id !== font.id),
                          })
                        }
                      />
                      {font.name}
                    </label>
                  ))}
                </div>
              </div>

              {assets.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Logos (from your assets)</Label>
                  <div className="flex flex-wrap gap-2">
                    {assets.map((asset) => {
                      const url = assetUrls.get(asset.id);
                      const selected = editing.logoAssetIds.includes(asset.id);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`Toggle logo ${asset.name}`}
                          onClick={() =>
                            setEditing({
                              ...editing,
                              logoAssetIds: selected
                                ? editing.logoAssetIds.filter((id) => id !== asset.id)
                                : [...editing.logoAssetIds, asset.id],
                            })
                          }
                          className={`size-12 overflow-hidden rounded-md border-2 p-1 cursor-pointer ${
                            selected ? "border-primary" : "border-border"
                          }`}
                        >
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- blob URL
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kit-company">Company</Label>
                  <Input
                    id="kit-company"
                    value={editing.contact.company ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        contact: { ...editing.contact, company: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kit-website">Website</Label>
                  <Input
                    id="kit-website"
                    value={editing.contact.website ?? ""}
                    placeholder="https://…"
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        contact: { ...editing.contact, website: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kit-warnings">Standard warnings (one per line)</Label>
                <Textarea
                  id="kit-warnings"
                  rows={3}
                  className="text-xs"
                  placeholder={"For external use only.\nKeep out of reach of children."}
                  value={editing.standardWarnings.join("\n")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      standardWarnings: e.target.value.split("\n"),
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={!editing?.name.trim()} loading={busy}>
              Save kit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>Projects keep their current styling.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={busy} onClick={() => void confirmDelete()}>
              Delete kit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
