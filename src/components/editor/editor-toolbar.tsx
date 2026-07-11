"use client";

import * as React from "react";
import {
  Circle as CircleIcon,
  Hexagon,
  Minus,
  Square,
  Star as StarIcon,
  Type,
} from "lucide-react";
import { addObject } from "@/lib/document/commands";
import { createShapeObject, createTextObject } from "@/lib/document/defaults";
import { loadFont } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
 * center and selects it. (Image, QR, and barcode tools arrive with their
 * property editors in the next milestone — no dead buttons.)
 */
export function EditorToolbar() {
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

  const tools: ToolButton[] = [
    { label: "Add text (T)", icon: Type, action: addText },
    { label: "Add rectangle (R)", icon: Square, action: () => addShape("rect") },
    { label: "Add ellipse (O)", icon: CircleIcon, action: () => addShape("ellipse") },
    { label: "Add line (L)", icon: Minus, action: () => addShape("line") },
    { label: "Add polygon", icon: Hexagon, action: () => addShape("polygon") },
    { label: "Add star", icon: StarIcon, action: () => addShape("star") },
  ];

  return (
    <div
      className="flex flex-col items-center gap-1 border-r border-border bg-panel px-1.5 py-3"
      role="toolbar"
      aria-label="Insert objects"
      aria-orientation="vertical"
    >
      {tools.slice(0, 1).map((tool) => (
        <ToolbarButton key={tool.label} tool={tool} />
      ))}
      <Separator className="my-1 w-6" />
      {tools.slice(1).map((tool) => (
        <ToolbarButton key={tool.label} tool={tool} />
      ))}
    </div>
  );
}
