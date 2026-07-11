"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Barcode,
  Circle as CircleIcon,
  Eye,
  EyeOff,
  Group as GroupIcon,
  Hexagon,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Minus,
  QrCode,
  Square,
  Star as StarIcon,
  Trash2,
  Type,
} from "lucide-react";
import type { LabelDocument, LabelObject } from "@/lib/document/schema";
import {
  removeObjects,
  reorderObjects,
  updateObject,
} from "@/lib/document/commands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<LabelObject["type"], React.ElementType> = {
  text: Type,
  rect: Square,
  ellipse: CircleIcon,
  line: Minus,
  polygon: Hexagon,
  star: StarIcon,
  image: ImageIcon,
  qrcode: QrCode,
  barcode: Barcode,
  group: GroupIcon,
};

function displayName(obj: LabelObject): string {
  if (obj.name) return obj.name;
  if (obj.type === "text") {
    const text = obj.text.trim().replaceAll("\n", " ");
    return text.length > 24 ? `${text.slice(0, 24)}…` : text || "Text";
  }
  return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
}

function LayerRow({ obj }: { obj: LabelObject }) {
  const selection = useEditorUiStore((s) => s.selection);
  const setSelection = useEditorUiStore((s) => s.setSelection);
  const toggleSelected = useEditorUiStore((s) => s.toggleSelected);
  const selected = selection.includes(obj.id);
  const [renaming, setRenaming] = React.useState(false);
  const Icon = TYPE_ICONS[obj.type];

  return (
    <li
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm",
        selected ? "bg-primary-subtle text-foreground" : "hover:bg-muted",
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        onClick={(e) => {
          if (e.shiftKey) toggleSelected(obj.id);
          else setSelection([obj.id]);
        }}
        onDoubleClick={() => setRenaming(true)}
        aria-label={`Select ${displayName(obj)}`}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {renaming ? (
          <Input
            autoFocus
            defaultValue={obj.name || displayName(obj)}
            className="h-6 px-1 text-xs"
            aria-label="Layer name"
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              updateObject(obj.id, { name: e.target.value.trim() });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <span className={cn("truncate", !obj.visible && "opacity-50")}>
            {displayName(obj)}
          </span>
        )}
      </button>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          aria-label={`Move ${displayName(obj)} up`}
          onClick={() => reorderObjects([obj.id], "forward")}
        >
          <ArrowUp className="size-3" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          aria-label={`Move ${displayName(obj)} down`}
          onClick={() => reorderObjects([obj.id], "backward")}
        >
          <ArrowDown className="size-3" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          aria-label={obj.visible ? "Hide layer" : "Show layer"}
          onClick={() => updateObject(obj.id, { visible: !obj.visible })}
        >
          {obj.visible ? (
            <Eye className="size-3" aria-hidden />
          ) : (
            <EyeOff className="size-3" aria-hidden />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          aria-label={obj.locked ? "Unlock layer" : "Lock layer"}
          onClick={() => updateObject(obj.id, { locked: !obj.locked })}
        >
          {obj.locked ? (
            <Lock className="size-3" aria-hidden />
          ) : (
            <LockOpen className="size-3" aria-hidden />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6 text-destructive"
          aria-label={`Delete ${displayName(obj)}`}
          onClick={() => removeObjects([obj.id])}
        >
          <Trash2 className="size-3" aria-hidden />
        </Button>
      </div>
      {obj.locked && (
        <Lock
          className="size-3 shrink-0 text-muted-foreground group-hover:hidden"
          aria-hidden
        />
      )}
    </li>
  );
}

export function LayersPanel({ doc }: { doc: LabelDocument }) {
  // Topmost object first (reverse z-order for display).
  const objects = [...doc.objects].reverse();

  if (objects.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        No objects yet — add text or shapes from the toolbar.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 p-2" aria-label="Layers (topmost first)">
      {objects.map((obj) => (
        <LayerRow key={obj.id} obj={obj} />
      ))}
    </ul>
  );
}
