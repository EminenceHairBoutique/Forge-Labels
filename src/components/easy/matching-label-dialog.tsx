"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LabelDocument } from "@/lib/document/schema";
import { getMaterial } from "@/lib/easy/materials";
import { getEasyPalette } from "@/lib/easy/palettes";
import { getEasyTemplate } from "@/lib/easy/templates";
import { buildFamilyVariant, suggestPaletteForStrength } from "@/lib/easy/family";
import { ensureEasyFonts } from "@/lib/easy/fields";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { getStorageAdapter } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";

/**
 * §19 — the product-family generator. One dialog, five fields, and the new
 * label keeps everything that makes the line look like a line: template,
 * fonts, material, dimensions, warnings, and any free objects from the
 * Advanced Editor. Strength color coding is suggested automatically and
 * remains a choice.
 */
export function MatchingLabelDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [productName, setProductName] = React.useState("");
  const [strength, setStrength] = React.useState("");
  const [lot, setLot] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [qr, setQr] = React.useState("");
  const [colorByStrength, setColorByStrength] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const material = doc.easy ? getMaterial(doc.easy.materialId) : undefined;
  const suggested =
    material && strength ? suggestPaletteForStrength(strength, material) : null;
  const currentPalette = doc.easy ? getEasyPalette(doc.easy.paletteId) : null;

  async function create() {
    if (!doc.easy || !productName.trim()) return;
    setBusy(true);
    try {
      const template = getEasyTemplate(doc.easy.templateId);
      if (template) await ensureEasyFonts(template);
      const variant = buildFamilyVariant(
        doc,
        {
          productName,
          strength: strength || undefined,
          lot: lot || undefined,
          expiry: expiry || undefined,
          qr: qr || undefined,
          paletteId:
            colorByStrength && suggested ? suggested.id : undefined,
        },
        measureTextHeightMm,
      );
      const project = await getStorageAdapter().createProject({
        name: productName.trim(),
        doc: variant,
      });
      toast.success("Matching label created", "Same brand, new product.");
      onOpenChange(false);
      router.push(`/easy/${project.id}`);
    } catch (err) {
      toast.error(
        "Couldn't create the matching label",
        err instanceof Error ? err.message : undefined,
      );
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a matching label</DialogTitle>
          <DialogDescription>
            Keeps your brand, fonts, material, size, and layout — you only
            change what&apos;s different about this product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fam-name">Product name</Label>
            <Input
              id="fam-name"
              value={productName}
              maxLength={60}
              placeholder="e.g. Retinol Serum Night"
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fam-strength">Strength</Label>
              <Input
                id="fam-strength"
                value={strength}
                maxLength={30}
                placeholder="e.g. 20 mg"
                onChange={(e) => setStrength(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fam-lot">Lot number</Label>
              <Input
                id="fam-lot"
                value={lot}
                maxLength={30}
                placeholder="optional"
                onChange={(e) => setLot(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fam-expiry">Expiration</Label>
              <Input
                id="fam-expiry"
                value={expiry}
                maxLength={30}
                placeholder="optional"
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fam-qr">QR destination</Label>
              <Input
                id="fam-qr"
                value={qr}
                maxLength={500}
                placeholder="optional"
                onChange={(e) => setQr(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Color by strength</p>
              <p className="text-xs text-muted-foreground">
                {colorByStrength && suggested
                  ? `Suggests “${suggested.name}” for ${strength.trim()}`
                  : currentPalette
                    ? `Keeps the current “${currentPalette.name}” colors`
                    : "Keeps the current colors"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {colorByStrength && suggested && (
                <span
                  aria-hidden
                  className="size-5 rounded-full border border-border"
                  style={{ backgroundColor: suggested.accent }}
                />
              )}
              <Switch
                checked={colorByStrength}
                onCheckedChange={setColorByStrength}
                aria-label="Color the new label by its strength"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void create()}
            disabled={!productName.trim()}
            loading={busy}
          >
            Create matching label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
