"use client";

import * as React from "react";
import {
  Barcode as BarcodeIcon,
  Circle as CircleIcon,
  Hexagon,
  Image as ImageIcon,
  Minus,
  QrCode,
  Square,
  Star as StarIcon,
  Type,
} from "lucide-react";
import { addObject } from "@/lib/document/commands";
import {
  createBarcodeObject,
  createImageObject,
  createQrObject,
  createShapeObject,
  createTextObject,
} from "@/lib/document/defaults";
import { prepareUpload, UploadError, UPLOAD_ACCEPT_ATTR } from "@/lib/images/upload";
import { loadFont } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toaster";

interface ToolButton {
  label: string;
  icon: React.ElementType;
  action: () => void | Promise<void>;
}

function ToolbarButton({ tool }: { tool: ToolButton }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tool.label}
          onClick={() => void tool.action()}
        >
          <tool.icon className="size-4.5" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{tool.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Object insertion toolbar. Each button drops a new object at the label
 * center and selects it; images go through upload validation + SVG
 * sanitization first.
 */
export function EditorToolbar() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    const doc = useDocumentStore.getState().doc;
    if (!file || !doc) return;
    try {
      const prepared = await prepareUpload(file);
      addObject(
        createImageObject(
          doc,
          { kind: "asset", assetId: prepared.asset.id },
          prepared.naturalWidthPx,
          prepared.naturalHeightPx,
          file.name.replace(/\.[a-z0-9]+$/i, ""),
        ),
      );
    } catch (err) {
      toast.error(
        "Couldn't add that image",
        err instanceof UploadError ? err.message : undefined,
      );
    }
  };
  const addText = async () => {
    const doc = useDocumentStore.getState().doc;
    if (!doc) return;
    // The default font is preloaded when the editor opens; a failed font
    // fetch must never block adding text (metrics just use the fallback).
    try {
      await loadFont("inter", 400);
    } catch {
      // fallback font metrics
    }
    const obj = createTextObject(doc);
    obj.heightMm = measureTextHeightMm(obj);
    addObject(obj);
  };

  const addShape = (shape: "rect" | "ellipse" | "line" | "polygon" | "star") => {
    const doc = useDocumentStore.getState().doc;
    if (!doc) return;
    addObject(createShapeObject(doc, shape));
  };

  const addWith = (factory: typeof createQrObject | typeof createBarcodeObject) => {
    const doc = useDocumentStore.getState().doc;
    if (!doc) return;
    addObject(factory(doc));
  };

  const insertTools: ToolButton[] = [
    { label: "Add text (T)", icon: Type, action: addText },
    { label: "Add rectangle (R)", icon: Square, action: () => addShape("rect") },
    { label: "Add ellipse (O)", icon: CircleIcon, action: () => addShape("ellipse") },
    { label: "Add line (L)", icon: Minus, action: () => addShape("line") },
    { label: "Add polygon", icon: Hexagon, action: () => addShape("polygon") },
    { label: "Add star", icon: StarIcon, action: () => addShape("star") },
  ];

  const mediaTools: ToolButton[] = [
    { label: "Add QR code", icon: QrCode, action: () => addWith(createQrObject) },
    {
      label: "Add barcode",
      icon: BarcodeIcon,
      action: () => addWith(createBarcodeObject),
    },
  ];

  return (
    <div
      className="flex flex-col items-center gap-1 border-r border-border bg-panel px-1.5 py-3"
      role="toolbar"
      aria-label="Insert objects"
      aria-orientation="vertical"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={UPLOAD_ACCEPT_ATTR}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onFileChosen(e)}
      />
      {insertTools.slice(0, 1).map((tool) => (
        <ToolbarButton key={tool.label} tool={tool} />
      ))}
      <Separator className="my-1 w-6" />
      {insertTools.slice(1).map((tool) => (
        <ToolbarButton key={tool.label} tool={tool} />
      ))}
      <Separator className="my-1 w-6" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Upload image (PNG, JPG, WebP, SVG)"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="size-4.5" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Upload image (PNG, JPG, WebP, SVG)</TooltipContent>
      </Tooltip>
      {mediaTools.map((tool) => (
        <ToolbarButton key={tool.label} tool={tool} />
      ))}
    </div>
  );
}
