"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: string): string | null {
  let v = value.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v.toLowerCase();
}

interface ColorFieldProps {
  id: string;
  label?: string;
  color: string;
  onCommit: (color: string) => void;
  className?: string;
}

/** Color swatch + hex input pair. */
export function ColorField({ id, label, color, onCommit, className }: ColorFieldProps) {
  const [text, setText] = React.useState(color);
  const [focused, setFocused] = React.useState(false);

  // Reflect external changes when not actively editing (adjust-during-render).
  const [lastColor, setLastColor] = React.useState(color);
  if (color !== lastColor) {
    setLastColor(color);
    if (!focused) setText(color);
  }

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label ? `${label} color picker` : "Color picker"}
          value={HEX_RE.test(color) && color.length === 7 ? color : "#000000"}
          onChange={(e) => onCommit(e.target.value)}
          className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-surface p-0.5 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
        />
        <Input
          id={id}
          value={text}
          className="h-8 font-mono text-xs"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const normalized = normalizeHex(text);
            if (normalized && normalized !== color) onCommit(normalized);
            else setText(color);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}
