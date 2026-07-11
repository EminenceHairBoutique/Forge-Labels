"use client";

import * as React from "react";
import { FlipHorizontal2, FlipVertical2, RefreshCcw } from "lucide-react";
import type {
  BarcodeObject,
  ImageObject,
  QrObject,
} from "@/lib/document/schema";
import { updateObject, withGesture } from "@/lib/document/commands";
import { prepareUpload, UploadError, UPLOAD_ACCEPT_ATTR } from "@/lib/images/upload";
import { qrModuleSizeMm, MIN_QR_MODULE_MM } from "@/lib/codes/qr";
import { validateBarcodeValue } from "@/lib/codes/validate";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { ColorField } from "../fields/color-field";
import { NumberField } from "../fields/dimension-field";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 px-4 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

function FilterSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? 0)}
        aria-label={label}
      />
    </div>
  );
}

export function ImageProps({ obj }: { obj: ImageObject }) {
  const replaceRef = React.useRef<HTMLInputElement>(null);

  const setFilters = (patch: Partial<ImageObject["filters"]>) =>
    updateObject<ImageObject>(obj.id, { filters: { ...obj.filters, ...patch } });

  const onReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareUpload(file);
      withGesture(() => {
        updateObject<ImageObject>(obj.id, {
          source: { kind: "asset", assetId: prepared.asset.id },
          naturalWidthPx: prepared.naturalWidthPx,
          naturalHeightPx: prepared.naturalHeightPx,
          crop: undefined,
        });
      });
    } catch (err) {
      toast.error(
        "Couldn't replace the image",
        err instanceof UploadError ? err.message : undefined,
      );
    }
  };

  return (
    <Section title="Image">
      <input
        ref={replaceRef}
        type="file"
        accept={UPLOAD_ACCEPT_ATTR}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onReplace(e)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => replaceRef.current?.click()}>
          <RefreshCcw className="size-3.5" aria-hidden /> Replace
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Flip horizontally"
          onClick={() => updateObject<ImageObject>(obj.id, { flipX: !obj.flipX })}
        >
          <FlipHorizontal2 className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Flip vertically"
          onClick={() => updateObject<ImageObject>(obj.id, { flipY: !obj.flipY })}
        >
          <FlipVertical2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div className="space-y-1">
        <Label htmlFor="image-fit" className="text-xs text-muted-foreground">
          Fit
        </Label>
        <Select
          value={obj.fit}
          onValueChange={(fit) =>
            updateObject<ImageObject>(obj.id, { fit: fit as ImageObject["fit"] })
          }
        >
          <SelectTrigger id="image-fit" className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Fill box (crop)</SelectItem>
            <SelectItem value="contain">Fit inside</SelectItem>
            <SelectItem value="fill">Stretch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FilterSlider
        id="image-brightness"
        label="Brightness"
        value={obj.filters.brightness}
        min={-0.6}
        max={0.6}
        step={0.02}
        format={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`}
        onChange={(brightness) => setFilters({ brightness })}
      />
      <FilterSlider
        id="image-contrast"
        label="Contrast"
        value={obj.filters.contrast}
        min={-60}
        max={60}
        step={2}
        format={(v) => `${v > 0 ? "+" : ""}${v}%`}
        onChange={(contrast) => setFilters({ contrast })}
      />
      <FilterSlider
        id="image-saturation"
        label="Saturation"
        value={obj.filters.saturation}
        min={-1}
        max={1}
        step={0.05}
        format={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`}
        onChange={(saturation) => setFilters({ saturation })}
      />
      <FilterSlider
        id="image-blur"
        label="Blur"
        value={obj.filters.blurPx}
        min={0}
        max={20}
        step={0.5}
        format={(v) => `${v}px`}
        onChange={(blurPx) => setFilters({ blurPx })}
      />
      <div className="flex items-center justify-between">
        <Label htmlFor="image-grayscale" className="text-xs text-muted-foreground">
          Grayscale
        </Label>
        <Switch
          id="image-grayscale"
          checked={obj.filters.grayscale}
          onCheckedChange={(grayscale) => setFilters({ grayscale })}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {obj.naturalWidthPx} × {obj.naturalHeightPx} px source
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// QR code
// ---------------------------------------------------------------------------

const QR_TYPE_HINTS: Record<QrObject["qrType"], { label: string; placeholder: string }> = {
  url: { label: "Website URL", placeholder: "https://your-site.com/verify" },
  text: { label: "Plain text", placeholder: "Any text payload" },
  email: { label: "Email", placeholder: "mailto:hello@your-site.com" },
  phone: { label: "Phone", placeholder: "tel:+15551234567" },
  wifi: { label: "Wi-Fi", placeholder: "WIFI:T:WPA;S:NetworkName;P:password;;" },
  vcard: {
    label: "Contact card",
    placeholder: "BEGIN:VCARD\nVERSION:3.0\nFN:Name\nTEL:+1555…\nEND:VCARD",
  },
};

export function QrProps({ obj }: { obj: QrObject }) {
  const moduleMm = React.useMemo(() => {
    try {
      return qrModuleSizeMm(obj);
    } catch {
      return null;
    }
  }, [obj]);

  const hint = QR_TYPE_HINTS[obj.qrType];

  return (
    <Section title="QR code">
      <div className="space-y-1">
        <Label htmlFor="qr-type" className="text-xs text-muted-foreground">
          Content type
        </Label>
        <Select
          value={obj.qrType}
          onValueChange={(qrType) =>
            updateObject<QrObject>(obj.id, { qrType: qrType as QrObject["qrType"] })
          }
        >
          <SelectTrigger id="qr-type" className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(QR_TYPE_HINTS) as QrObject["qrType"][]).map((t) => (
              <SelectItem key={t} value={t}>
                {QR_TYPE_HINTS[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="qr-value" className="text-xs text-muted-foreground">
          {hint.label}
        </Label>
        <Textarea
          id="qr-value"
          value={obj.value}
          rows={obj.qrType === "vcard" ? 5 : 2}
          placeholder={hint.placeholder}
          className="font-mono text-xs"
          onChange={(e) => updateObject<QrObject>(obj.id, { value: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="qr-ec" className="text-xs text-muted-foreground">
            Error correction
          </Label>
          <Select
            value={obj.ecLevel}
            onValueChange={(ecLevel) =>
              updateObject<QrObject>(obj.id, { ecLevel: ecLevel as QrObject["ecLevel"] })
            }
          >
            <SelectTrigger id="qr-ec" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="L">L — 7%</SelectItem>
              <SelectItem value="M">M — 15%</SelectItem>
              <SelectItem value="Q">Q — 25%</SelectItem>
              <SelectItem value="H">H — 30%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="qr-shape" className="text-xs text-muted-foreground">
            Module style
          </Label>
          <Select
            value={obj.moduleShape}
            onValueChange={(moduleShape) =>
              updateObject<QrObject>(obj.id, {
                moduleShape: moduleShape as QrObject["moduleShape"],
              })
            }
          >
            <SelectTrigger id="qr-shape" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="rounded">Rounded</SelectItem>
              <SelectItem value="dot">Dots</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ColorField
          id="qr-fg"
          label="Modules"
          color={obj.fgColor}
          onCommit={(fgColor) => updateObject<QrObject>(obj.id, { fgColor })}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Background</Label>
          <div className="flex items-center gap-2">
            <Switch
              id="qr-bg-enabled"
              checked={obj.bgColor !== null}
              onCheckedChange={(on) =>
                updateObject<QrObject>(obj.id, { bgColor: on ? "#ffffff" : null })
              }
              aria-label="Opaque background"
            />
            {obj.bgColor !== null && (
              <input
                type="color"
                aria-label="Background color"
                value={obj.bgColor}
                onChange={(e) =>
                  updateObject<QrObject>(obj.id, { bgColor: e.target.value })
                }
                className="size-8 cursor-pointer rounded-md border border-input bg-surface p-0.5"
              />
            )}
          </div>
        </div>
      </div>

      <NumberField
        id="qr-quiet"
        label="Quiet zone (modules)"
        value={obj.quietModules}
        min={0}
        max={10}
        onCommit={(quietModules) =>
          updateObject<QrObject>(obj.id, { quietModules: Math.round(quietModules) })
        }
      />

      {moduleMm !== null &&
        (moduleMm < MIN_QR_MODULE_MM ? (
          <Callout variant="warning">
            Modules print at {moduleMm.toFixed(2)} mm — below the{" "}
            {MIN_QR_MODULE_MM} mm scanning guideline. Enlarge the code, shorten
            the payload, or lower the error-correction level.
          </Callout>
        ) : (
          <p className="text-xs text-muted-foreground">
            Module size ≈ {moduleMm.toFixed(2)} mm — comfortably scannable.
          </p>
        ))}
      {obj.quietModules < 4 && (
        <Callout variant="warning">
          The QR spec requires a 4-module quiet zone; smaller margins can break
          scanning on busy backgrounds.
        </Callout>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Barcode
// ---------------------------------------------------------------------------

const SYMBOLOGY_LABELS: Record<BarcodeObject["symbology"], string> = {
  code128: "Code 128",
  code39: "Code 39",
  ean13: "EAN-13",
  upca: "UPC-A",
  datamatrix: "Data Matrix",
};

export function BarcodeProps({ obj }: { obj: BarcodeObject }) {
  const validation = validateBarcodeValue(obj.symbology, obj.value);

  return (
    <Section title="Barcode">
      <div className="space-y-1">
        <Label htmlFor="barcode-symbology" className="text-xs text-muted-foreground">
          Format
        </Label>
        <Select
          value={obj.symbology}
          onValueChange={(symbology) => {
            const next = symbology as BarcodeObject["symbology"];
            updateObject<BarcodeObject>(obj.id, {
              symbology: next,
              ...(next === "datamatrix"
                ? { heightMm: obj.widthMm } // Data Matrix is square
                : {}),
            });
          }}
        >
          <SelectTrigger id="barcode-symbology" className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SYMBOLOGY_LABELS) as BarcodeObject["symbology"][]).map((s) => (
              <SelectItem key={s} value={s}>
                {SYMBOLOGY_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="barcode-value" className="text-xs text-muted-foreground">
          Value
        </Label>
        <Input
          id="barcode-value"
          value={obj.value}
          className="h-8 font-mono text-xs"
          aria-invalid={!validation.ok}
          onChange={(e) =>
            updateObject<BarcodeObject>(obj.id, { value: e.target.value })
          }
        />
        {!validation.ok ? (
          <p className="text-xs text-destructive">{validation.message}</p>
        ) : validation.normalized && validation.normalized !== obj.value ? (
          <p className="text-xs text-muted-foreground">
            Check digit added automatically: {validation.normalized}
          </p>
        ) : null}
      </div>

      {obj.symbology !== "datamatrix" && (
        <div className="flex items-center justify-between">
          <Label htmlFor="barcode-text" className="text-xs text-muted-foreground">
            Human-readable text
          </Label>
          <Switch
            id="barcode-text"
            checked={obj.showText}
            onCheckedChange={(showText) =>
              updateObject<BarcodeObject>(obj.id, { showText })
            }
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ColorField
          id="barcode-fg"
          label="Bars"
          color={obj.fgColor}
          onCommit={(fgColor) => updateObject<BarcodeObject>(obj.id, { fgColor })}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Background</Label>
          <div className="flex items-center gap-2">
            <Switch
              id="barcode-bg-enabled"
              checked={obj.bgColor !== null}
              onCheckedChange={(on) =>
                updateObject<BarcodeObject>(obj.id, { bgColor: on ? "#ffffff" : null })
              }
              aria-label="Opaque background"
            />
            {obj.bgColor !== null && (
              <input
                type="color"
                aria-label="Background color"
                value={obj.bgColor}
                onChange={(e) =>
                  updateObject<BarcodeObject>(obj.id, { bgColor: e.target.value })
                }
                className="size-8 cursor-pointer rounded-md border border-input bg-surface p-0.5"
              />
            )}
          </div>
        </div>
      </div>

      <Callout variant="info">
        Scanners need dark bars on a light, matte background with clear
        margins. Test a printed sample before a production run.
      </Callout>
    </Section>
  );
}
