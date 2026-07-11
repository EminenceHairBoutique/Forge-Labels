"use client";

import * as React from "react";
import Link from "next/link";
import { Palette } from "lucide-react";
import type { LabelDocument, TextObject } from "@/lib/document/schema";
import { addObject, findObject, updateObjects, withGesture, updateObject } from "@/lib/document/commands";
import { createImageObject, createTextObject } from "@/lib/document/defaults";
import { loadFont, FONT_FAMILIES, availableWeights } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { getStorageAdapter } from "@/lib/storage";
import type { BrandKitRecord } from "@/lib/storage/types";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

/**
 * Brand tab: one-click application of a kit's colors, fonts, logos, and
 * standard text to the current document/selection.
 */
export function BrandPanel({ doc }: { doc: LabelDocument }) {
  const [kits, setKits] = React.useState<BrandKitRecord[] | null>(null);
  const [activeKitId, setActiveKitId] = React.useState<string | null>(null);
  const [logoUrls, setLogoUrls] = React.useState<Map<string, string>>(new Map());
  const selection = useEditorUiStore((s) => s.selection);

  React.useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    (async () => {
      const adapter = getStorageAdapter();
      const list = await adapter.listBrandKits();
      if (!alive) return;
      setKits(list);
      setActiveKitId((current) => current ?? list[0]?.id ?? null);
      const map = new Map<string, string>();
      for (const kit of list) {
        for (const assetId of kit.logoAssetIds) {
          if (map.has(assetId)) continue;
          const blob = await adapter.getAssetBlob(assetId);
          if (blob) {
            const url = URL.createObjectURL(blob);
            urls.push(url);
            map.set(assetId, url);
          }
        }
      }
      if (alive) setLogoUrls(map);
    })().catch(() => {
      if (alive) setKits([]);
    });
    return () => {
      alive = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const kit = kits?.find((k) => k.id === activeKitId) ?? null;

  function applyColor(color: string) {
    const targets = selection
      .map((id) => findObject(doc, id))
      .filter((o) => o !== null)
      .filter((o) => "fill" in o || o.type === "line");
    if (targets.length === 0) {
      toast.info("Select an object first", "Click a shape or text, then a brand color.");
      return;
    }
    withGesture(() => {
      updateObjects(
        targets.map((o) => o.id),
        (o) =>
          o.type === "line"
            ? { color }
            : ({ fill: { type: "solid", color } } as Partial<TextObject>),
      );
    });
  }

  async function applyFont(fontFamilyId: string) {
    const textTargets = selection
      .map((id) => findObject(doc, id))
      .filter((o): o is TextObject => o?.type === "text");
    if (textTargets.length === 0) {
      toast.info("Select a text object first");
      return;
    }
    for (const obj of textTargets) {
      const weights = availableWeights(fontFamilyId);
      const fontWeight = (
        weights.includes(obj.fontWeight) ? obj.fontWeight : (weights[0] ?? 400)
      ) as TextObject["fontWeight"];
      await loadFont(fontFamilyId, fontWeight);
      const next = { ...obj, fontFamilyId, fontWeight };
      withGesture(() => {
        updateObject<TextObject>(obj.id, {
          fontFamilyId,
          fontWeight,
          heightMm: measureTextHeightMm(next),
        });
      });
    }
  }

  async function insertLogo(assetId: string) {
    const adapter = getStorageAdapter();
    const blob = await adapter.getAssetBlob(assetId);
    if (!blob) {
      toast.error("Logo asset is missing");
      return;
    }
    const bitmapSize = await (async () => {
      try {
        const bmp = await createImageBitmap(blob);
        const size = { w: bmp.width, h: bmp.height };
        bmp.close();
        return size;
      } catch {
        return { w: 512, h: 512 };
      }
    })();
    addObject(
      createImageObject(
        doc,
        { kind: "asset", assetId },
        bitmapSize.w,
        bitmapSize.h,
        "Logo",
      ),
    );
  }

  function insertSnippet(text: string, fontSizePt = 4.5) {
    const obj = createTextObject(doc, {
      text,
      fontSizePt,
      widthMm: Math.min(doc.label.widthMm * 0.8, 70),
      align: "left",
    });
    obj.heightMm = measureTextHeightMm(obj);
    addObject(obj);
  }

  if (kits === null) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (kits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <Palette className="size-7 text-muted-foreground/50" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No brand kits yet. Create one to reuse colors, fonts, and logos across
          projects.
        </p>
        <Link
          href="/brand-kits"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Create a brand kit
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {kits.length > 1 && (
        <Select value={activeKitId ?? undefined} onValueChange={setActiveKitId}>
          <SelectTrigger className="h-8" aria-label="Brand kit">
            {kit?.name ?? "Choose kit"}
          </SelectTrigger>
          <SelectContent>
            {kits.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {kit && (
        <>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Colors
            </h3>
            <div className="flex flex-wrap gap-2">
              {kit.colors.map((color, i) => (
                <button
                  key={`${color}-${i}`}
                  className="size-8 rounded-full border border-border shadow-xs cursor-pointer transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                  aria-label={`Apply brand color ${color} to selection`}
                  title={color}
                  onClick={() => applyColor(color)}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Click to apply to the selected objects.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fonts
            </h3>
            <div className="flex flex-col gap-1">
              {kit.fontFamilyIds.map((id) => {
                const family = FONT_FAMILIES.find((f) => f.id === id);
                if (!family) return null;
                return (
                  <button
                    key={id}
                    className="rounded-md border border-border px-3 py-1.5 text-left text-sm cursor-pointer hover:border-primary/50"
                    onClick={() => void applyFont(id)}
                    aria-label={`Apply font ${family.name} to selected text`}
                  >
                    {family.name}
                  </button>
                );
              })}
            </div>
          </section>

          {kit.logoAssetIds.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Logos
              </h3>
              <div className="flex flex-wrap gap-2">
                {kit.logoAssetIds.map((assetId) => {
                  const url = logoUrls.get(assetId);
                  return (
                    <button
                      key={assetId}
                      className="size-14 rounded-md border border-border bg-canvas-backdrop p-1.5 cursor-pointer hover:border-primary/50"
                      onClick={() => void insertLogo(assetId)}
                      aria-label="Insert logo onto the label"
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- blob URL
                        <img src={url} alt="" className="h-full w-full object-contain" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {(kit.standardWarnings.length > 0 ||
            kit.contact.website ||
            kit.contact.company) && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Standard text
              </h3>
              <div className="flex flex-col gap-1">
                {kit.contact.company && (
                  <SnippetButton
                    label={kit.contact.company}
                    onClick={() => insertSnippet(kit.contact.company!)}
                  />
                )}
                {kit.contact.website && (
                  <SnippetButton
                    label={kit.contact.website}
                    onClick={() => insertSnippet(kit.contact.website!)}
                  />
                )}
                {kit.standardWarnings.map((warning, i) => (
                  <SnippetButton
                    key={i}
                    label={warning}
                    onClick={() => insertSnippet(warning, 4)}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Click to insert as a text object.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SnippetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="truncate rounded-md border border-border px-3 py-1.5 text-left text-xs text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-foreground"
      onClick={onClick}
      title={label}
    >
      {label}
    </button>
  );
}
