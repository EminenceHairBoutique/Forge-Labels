"use client";

import * as React from "react";
import {
  formatMm,
  parseToMm,
  UNIT_DISPLAY_DECIMALS,
  type Unit,
} from "@/lib/geometry/units";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { cn } from "@/lib/utils";

interface DimensionFieldProps {
  id: string;
  label: string;
  mm: number;
  onCommit: (mm: number) => void;
  min?: number;
  max?: number;
  className?: string;
  /** Override the display unit (defaults to the editor's unit). */
  unit?: Unit;
  disabled?: boolean;
}

/**
 * Numeric field displaying a canonical-mm value in the editor's display
 * unit. Text is a view; commits happen on Enter/blur/arrow-step, and the mm
 * value is never round-tripped through the display string.
 */
export function DimensionField({
  id,
  label,
  mm,
  onCommit,
  min,
  max,
  className,
  unit: unitOverride,
  disabled,
}: DimensionFieldProps) {
  const editorUnit = useEditorUiStore((s) => s.displayUnit);
  const unit = unitOverride ?? editorUnit;
  const [text, setText] = React.useState(() =>
    formatMm(mm, unit, { suffix: false }),
  );
  const [focused, setFocused] = React.useState(false);

  // Reflect external changes when not actively editing (adjust-during-render).
  const formatted = formatMm(mm, unit, { suffix: false });
  const [lastFormatted, setLastFormatted] = React.useState(formatted);
  if (formatted !== lastFormatted) {
    setLastFormatted(formatted);
    if (!focused) setText(formatted);
  }

  const clamp = React.useCallback(
    (value: number) => {
      let v = value;
      if (min !== undefined) v = Math.max(v, min);
      if (max !== undefined) v = Math.min(v, max);
      return v;
    },
    [min, max],
  );

  const commitText = React.useCallback(() => {
    const parsed = parseToMm(text, unit);
    if (parsed === null) {
      setText(formatMm(mm, unit, { suffix: false }));
      return;
    }
    const next = clamp(parsed);
    if (Math.abs(next - mm) > 1e-6) onCommit(next);
    setText(formatMm(next, unit, { suffix: false }));
  }, [text, unit, mm, clamp, onCommit]);

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          disabled={disabled}
          className="h-8 pr-8 text-sm tabular-nums"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commitText();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const stepMm = e.shiftKey ? 1 : 10 ** -UNIT_DISPLAY_DECIMALS[unit] * (unit === "mm" ? 1 : unit === "cm" ? 10 : 25.4);
              const delta = e.key === "ArrowUp" ? stepMm : -stepMm;
              const next = clamp(mm + delta);
              onCommit(next);
              setText(formatMm(next, unit, { suffix: false }));
            }
          }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}

/** Plain numeric field (points, degrees, counts). */
export function NumberField({
  id,
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  className,
}: NumberFieldProps) {
  const [text, setText] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);

  // Reflect external changes when not actively editing (adjust-during-render).
  const formatted = String(Math.round(value * 100) / 100);
  const [lastFormatted, setLastFormatted] = React.useState(formatted);
  if (formatted !== lastFormatted) {
    setLastFormatted(formatted);
    if (!focused) setText(formatted);
  }

  const clamp = (v: number) => {
    let out = v;
    if (min !== undefined) out = Math.max(out, min);
    if (max !== undefined) out = Math.min(out, max);
    return out;
  };

  const commit = () => {
    const parsed = Number.parseFloat(text.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }
    const next = clamp(parsed);
    if (Math.abs(next - value) > 1e-9) onCommit(next);
    setText(String(Math.round(next * 100) / 100));
  };

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          className="h-8 pr-8 text-sm tabular-nums"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const delta = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? step * 5 : step);
              const next = clamp(value + delta);
              onCommit(next);
              setText(String(Math.round(next * 100) / 100));
            }
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
