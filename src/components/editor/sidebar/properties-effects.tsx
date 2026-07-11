"use client";

import * as React from "react";
import type { Fill, Shadow, Stroke } from "@/lib/document/schema";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ColorField } from "../fields/color-field";
import { NumberField } from "../fields/dimension-field";

/** Shared appearance controls used by text and shape property panels. */

type FillKind = "solid" | "linear-gradient" | "none";

interface FillSectionProps {
  id: string;
  fill: Fill;
  onChange: (fill: Fill) => void;
  allowNone?: boolean;
}

export function FillSection({ id, fill, onChange, allowNone }: FillSectionProps) {
  const kind: FillKind =
    fill.type === "linear-gradient"
      ? "linear-gradient"
      : fill.type === "none"
        ? "none"
        : "solid";

  const solidColor = fill.type === "solid" ? fill.color : "#4c3d8f";
  const stops =
    fill.type === "linear-gradient"
      ? fill.stops
      : [
          { offset: 0, color: solidColor },
          { offset: 1, color: "#8b7cf0" },
        ];
  const angle = fill.type === "linear-gradient" ? fill.angleDeg : 90;

  function setKind(next: FillKind) {
    if (next === kind) return;
    if (next === "none") onChange({ type: "none" });
    else if (next === "solid") onChange({ type: "solid", color: stops[0]?.color ?? "#4c3d8f" });
    else onChange({ type: "linear-gradient", angleDeg: angle, stops });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-kind`} className="text-xs text-muted-foreground">
          Fill
        </Label>
        <Select value={kind} onValueChange={(v) => setKind(v as FillKind)}>
          <SelectTrigger id={`${id}-kind`} className="h-7 w-36 text-xs">
            {kind === "solid" ? "Solid" : kind === "linear-gradient" ? "Gradient" : "None"}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="linear-gradient">Gradient</SelectItem>
            {allowNone && <SelectItem value="none">None</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {kind === "solid" && (
        <ColorField
          id={`${id}-color`}
          color={solidColor}
          onCommit={(color) => onChange({ type: "solid", color })}
        />
      )}

      {kind === "linear-gradient" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              id={`${id}-stop-a`}
              label="Start"
              color={stops[0]?.color ?? "#4c3d8f"}
              onCommit={(color) =>
                onChange({
                  type: "linear-gradient",
                  angleDeg: angle,
                  stops: [{ offset: 0, color }, stops[stops.length - 1] ?? { offset: 1, color }],
                })
              }
            />
            <ColorField
              id={`${id}-stop-b`}
              label="End"
              color={stops[stops.length - 1]?.color ?? "#8b7cf0"}
              onCommit={(color) =>
                onChange({
                  type: "linear-gradient",
                  angleDeg: angle,
                  stops: [stops[0] ?? { offset: 0, color }, { offset: 1, color }],
                })
              }
            />
          </div>
          <NumberField
            id={`${id}-angle`}
            label="Angle"
            value={angle}
            min={0}
            max={360}
            step={15}
            suffix="deg"
            onCommit={(angleDeg) =>
              onChange({ type: "linear-gradient", angleDeg, stops })
            }
          />
        </div>
      )}
    </div>
  );
}

interface StrokeSectionProps {
  id: string;
  stroke: Stroke | undefined;
  onChange: (stroke: Stroke | undefined) => void;
  label?: string;
}

export function StrokeSection({ id, stroke, onChange, label = "Outline" }: StrokeSectionProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <ColorField
          id={`${id}-stroke-color`}
          color={stroke?.color ?? "#1a1a1a"}
          onCommit={(color) => onChange({ color, widthPt: stroke?.widthPt ?? 1 })}
        />
        <NumberField
          id={`${id}-stroke-width`}
          label="Width"
          value={stroke?.widthPt ?? 0}
          min={0}
          max={40}
          step={0.25}
          suffix="pt"
          className="w-24"
          onCommit={(widthPt) =>
            onChange(
              widthPt <= 0
                ? undefined
                : { color: stroke?.color ?? "#1a1a1a", widthPt },
            )
          }
        />
      </div>
    </div>
  );
}

const DEFAULT_SHADOW: Shadow = {
  color: "#000000",
  opacity: 0.4,
  blurPt: 3,
  offsetXPt: 1,
  offsetYPt: 1.5,
};

interface ShadowSectionProps {
  id: string;
  shadow: Shadow | undefined;
  onChange: (shadow: Shadow | undefined) => void;
}

export function ShadowSection({ id, shadow, onChange }: ShadowSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={`${id}-shadow-enabled`} className="text-xs text-muted-foreground">
          Shadow
        </Label>
        <Switch
          id={`${id}-shadow-enabled`}
          checked={shadow !== undefined}
          onCheckedChange={(on) => onChange(on ? DEFAULT_SHADOW : undefined)}
        />
      </div>
      {shadow && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <ColorField
              id={`${id}-shadow-color`}
              color={shadow.color}
              onCommit={(color) => onChange({ ...shadow, color })}
            />
            <NumberField
              id={`${id}-shadow-blur`}
              label="Blur"
              value={shadow.blurPt}
              min={0}
              max={40}
              step={0.5}
              suffix="pt"
              className="w-24"
              onCommit={(blurPt) => onChange({ ...shadow, blurPt })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              id={`${id}-shadow-x`}
              label="Offset X"
              value={shadow.offsetXPt}
              min={-40}
              max={40}
              step={0.5}
              suffix="pt"
              onCommit={(offsetXPt) => onChange({ ...shadow, offsetXPt })}
            />
            <NumberField
              id={`${id}-shadow-y`}
              label="Offset Y"
              value={shadow.offsetYPt}
              min={-40}
              max={40}
              step={0.5}
              suffix="pt"
              onCommit={(offsetYPt) => onChange({ ...shadow, offsetYPt })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Opacity</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(shadow.opacity * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[Math.round(shadow.opacity * 100)]}
              onValueChange={([v]) => onChange({ ...shadow, opacity: (v ?? 40) / 100 })}
              aria-label="Shadow opacity"
            />
          </div>
        </div>
      )}
    </div>
  );
}
