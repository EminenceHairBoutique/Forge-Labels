"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Lock,
  LockOpen,
} from "lucide-react";
import type {
  LabelDocument,
  LabelObject,
  LineObject,
  PolygonObject,
  RectObject,
  StarObject,
  TextObject,
} from "@/lib/document/schema";
import {
  findObject,
  reorderObjects,
  setBackground,
  updateLabelGeometry,
  updateObject,
  updateObjects,
  withGesture,
} from "@/lib/document/commands";
import {
  alignObjects,
  distributeObjects,
  groupObjects,
  ungroupObjects,
  type AlignEdge,
} from "@/lib/document/structure-commands";
import { curvedTextBox } from "@/lib/render/node-configs";
import { loadFont, FONT_FAMILIES, availableWeights } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { DimensionField, NumberField } from "../fields/dimension-field";
import { ColorField } from "../fields/color-field";
import { FillSection, ShadowSection, StrokeSection } from "./properties-effects";
import { BarcodeProps, ImageProps, QrProps } from "./properties-media";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
// Document properties (no selection)
// ---------------------------------------------------------------------------

function DocumentProps({ doc }: { doc: LabelDocument }) {
  const bg = doc.background;
  return (
    <>
      <Section title="Label size">
        <div className="grid grid-cols-2 gap-3">
          <DimensionField
            id="doc-width"
            label="Width"
            mm={doc.label.widthMm}
            min={5}
            max={600}
            onCommit={(widthMm) => updateLabelGeometry({ widthMm })}
          />
          <DimensionField
            id="doc-height"
            label="Height"
            mm={doc.label.heightMm}
            min={5}
            max={600}
            onCommit={(heightMm) => updateLabelGeometry({ heightMm })}
          />
          <DimensionField
            id="doc-bleed"
            label="Bleed"
            mm={doc.label.bleedMm}
            min={0}
            max={10}
            onCommit={(bleedMm) => updateLabelGeometry({ bleedMm })}
          />
          <DimensionField
            id="doc-safe"
            label="Safe zone"
            mm={doc.label.safeMm}
            min={0}
            max={15}
            onCommit={(safeMm) => updateLabelGeometry({ safeMm })}
          />
          {doc.label.shape === "rect" && (
            <DimensionField
              id="doc-corner"
              label="Corner radius"
              mm={doc.label.cornerRadiusMm}
              min={0}
              max={Math.min(doc.label.widthMm, doc.label.heightMm) / 2}
              onCommit={(cornerRadiusMm) => updateLabelGeometry({ cornerRadiusMm })}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Vial: ⌀{doc.vial.diameterMm.toFixed(1)} mm · wall{" "}
          {doc.vial.straightWallHeightMm.toFixed(1)} mm. Resizing the label does
          not re-measure the vial — check the seam after big changes.
        </p>
      </Section>
      <Separator />
      <Section title="Background">
        <div className="flex items-center justify-between">
          <Label htmlFor="bg-transparent" className="text-sm">
            Transparent
          </Label>
          <Switch
            id="bg-transparent"
            checked={bg.type === "none"}
            onCheckedChange={(checked) =>
              setBackground(
                checked ? { type: "none" } : { type: "solid", color: "#ffffff" },
              )
            }
          />
        </div>
        {bg.type === "solid" && (
          <ColorField
            id="bg-color"
            label="Color"
            color={bg.color}
            onCommit={(color) => setBackground({ type: "solid", color })}
          />
        )}
        {bg.type === "none" && (
          <p className="text-xs text-muted-foreground">
            The checkerboard preview stands in for clear or metallic stock —
            exports keep true transparency.
          </p>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Common object properties
// ---------------------------------------------------------------------------

function CommonProps({ objects }: { objects: LabelObject[] }) {
  const single = objects.length === 1 ? objects[0] : null;
  const ids = objects.map((o) => o.id);
  const allLocked = objects.every((o) => o.locked);
  const opacity = single?.opacity ?? objects[0]?.opacity ?? 1;

  return (
    <Section title={single ? single.type : `${objects.length} objects`}>
      {single && (
        <div className="grid grid-cols-2 gap-3">
          <DimensionField
            id="obj-x"
            label="X (center)"
            mm={single.xMm}
            onCommit={(xMm) => updateObject(single.id, { xMm })}
          />
          <DimensionField
            id="obj-y"
            label="Y (center)"
            mm={single.yMm}
            onCommit={(yMm) => updateObject(single.id, { yMm })}
          />
          <DimensionField
            id="obj-w"
            label="Width"
            mm={single.widthMm}
            min={0.5}
            onCommit={(widthMm) => {
              if (single.type === "text") {
                const next = { ...single, widthMm } as TextObject;
                withGesture(() => {
                  updateObject(single.id, {
                    widthMm,
                    heightMm: measureTextHeightMm(next),
                  });
                });
              } else if (
                single.type === "polygon" ||
                single.type === "star" ||
                single.type === "qrcode"
              ) {
                updateObject(single.id, { widthMm, heightMm: widthMm });
              } else {
                updateObject(single.id, { widthMm });
              }
            }}
          />
          <DimensionField
            id="obj-h"
            label="Height"
            mm={single.heightMm}
            min={0.5}
            disabled={single.type === "text" || single.type === "line"}
            onCommit={(heightMm) => {
              if (
                single.type === "polygon" ||
                single.type === "star" ||
                single.type === "qrcode"
              ) {
                updateObject(single.id, { widthMm: heightMm, heightMm });
              } else {
                updateObject(single.id, { heightMm });
              }
            }}
          />
          <NumberField
            id="obj-rotation"
            label="Rotation"
            value={single.rotationDeg}
            min={-360}
            max={360}
            suffix="deg"
            onCommit={(rotationDeg) => updateObject(single.id, { rotationDeg })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Opacity</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(opacity * 100)}%
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[Math.round(opacity * 100)]}
          onValueChange={([v]) =>
            updateObjects(ids, () => ({ opacity: (v ?? 100) / 100 }))
          }
          aria-label="Opacity"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Bring to front"
            onClick={() => reorderObjects(ids, "front")}
          >
            <ChevronsUp className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Bring forward"
            onClick={() => reorderObjects(ids, "forward")}
          >
            <ArrowUp className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Send backward"
            onClick={() => reorderObjects(ids, "backward")}
          >
            <ArrowDown className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Send to back"
            onClick={() => reorderObjects(ids, "back")}
          >
            <ChevronsDown className="size-3.5" aria-hidden />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateObjects(ids, (o) => ({ locked: !o.locked }))}
        >
          {allLocked ? (
            <>
              <LockOpen className="size-3.5" aria-hidden /> Unlock
            </>
          ) : (
            <>
              <Lock className="size-3.5" aria-hidden /> Lock
            </>
          )}
        </Button>
      </div>

      <AlignControls ids={ids} />

      {(objects.length >= 2 || objects.some((o) => o.type === "group")) && (
        <div className="flex gap-2">
          {objects.length >= 2 && (
            <Button variant="outline" size="sm" onClick={() => groupObjects(ids)}>
              Group
            </Button>
          )}
          {objects.some((o) => o.type === "group") && (
            <Button variant="outline" size="sm" onClick={() => ungroupObjects(ids)}>
              Ungroup
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}

const ALIGN_BUTTONS: { edge: AlignEdge; label: string }[] = [
  { edge: "left", label: "Align left" },
  { edge: "center-h", label: "Align horizontal center" },
  { edge: "right", label: "Align right" },
  { edge: "top", label: "Align top" },
  { edge: "middle-v", label: "Align vertical middle" },
  { edge: "bottom", label: "Align bottom" },
];

function AlignControls({ ids }: { ids: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        Align {ids.length === 1 ? "to label" : "selection"}
      </Label>
      <div className="flex flex-wrap items-center gap-1">
        {ALIGN_BUTTONS.map(({ edge, label }) => (
          <Button
            key={edge}
            variant="outline"
            size="icon-sm"
            aria-label={label}
            title={label}
            onClick={() => alignObjects(ids, edge)}
          >
            <AlignGlyph edge={edge} />
          </Button>
        ))}
        {ids.length >= 3 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => distributeObjects(ids, "horizontal")}
            >
              Distribute H
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => distributeObjects(ids, "vertical")}
            >
              Distribute V
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Minimal inline glyphs for the six align buttons. */
function AlignGlyph({ edge }: { edge: AlignEdge }) {
  const bar =
    edge === "left" || edge === "right" || edge === "center-h" ? "v" : "h";
  const pos = edge.includes("left")
    ? "start"
    : edge.includes("right")
      ? "end"
      : edge.includes("top")
        ? "start"
        : edge.includes("bottom")
          ? "end"
          : "center";
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      {bar === "v" ? (
        <>
          <rect
            x={pos === "start" ? 1 : pos === "end" ? 13.5 : 7.25}
            y="1"
            width="1.5"
            height="14"
            fill="currentColor"
          />
          <rect x="4" y="3" width="8" height="3.5" rx="0.75" fill="currentColor" opacity="0.55" />
          <rect x="4" y="9.5" width="6" height="3.5" rx="0.75" fill="currentColor" opacity="0.55"
            transform={pos === "end" ? "translate(2 0)" : pos === "center" ? "translate(1 0)" : undefined}
          />
        </>
      ) : (
        <>
          <rect
            x="1"
            y={pos === "start" ? 1 : pos === "end" ? 13.5 : 7.25}
            width="14"
            height="1.5"
            fill="currentColor"
          />
          <rect x="3" y="4" width="3.5" height="8" rx="0.75" fill="currentColor" opacity="0.55" />
          <rect x="9.5" y="4" width="3.5" height="6" rx="0.75" fill="currentColor" opacity="0.55"
            transform={pos === "end" ? "translate(0 2)" : pos === "center" ? "translate(0 1)" : undefined}
          />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Type-specific properties

function TextProps({ obj }: { obj: TextObject }) {
  const remeasure = (patch: Partial<TextObject>) => {
    const next = { ...obj, ...patch } as TextObject;
    withGesture(() => {
      updateObject<TextObject>(obj.id, {
        ...patch,
        heightMm: measureTextHeightMm(next),
      });
    });
  };

  return (
    <Section title="Text">
      <Textarea
        aria-label="Text content"
        value={obj.text}
        rows={2}
        className="text-sm"
        onChange={(e) => remeasure({ text: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="text-font" className="text-xs text-muted-foreground">
            Font
          </Label>
          <Select
            value={obj.fontFamilyId}
            onValueChange={(fontFamilyId) => {
              const weights = availableWeights(fontFamilyId);
              const fontWeight = (
                weights.includes(obj.fontWeight) ? obj.fontWeight : (weights[0] ?? 400)
              ) as TextObject["fontWeight"];
              void loadFont(fontFamilyId, fontWeight).then(() =>
                remeasure({ fontFamilyId, fontWeight }),
              );
            }}
          >
            <SelectTrigger id="text-font" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="text-weight" className="text-xs text-muted-foreground">
            Weight
          </Label>
          <Select
            value={String(obj.fontWeight)}
            onValueChange={(w) => {
              const fontWeight = Number(w) as TextObject["fontWeight"];
              void loadFont(obj.fontFamilyId, fontWeight).then(() =>
                remeasure({ fontWeight }),
              );
            }}
          >
            <SelectTrigger id="text-weight" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableWeights(obj.fontFamilyId).map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NumberField
          id="text-size"
          label="Size"
          value={obj.fontSizePt}
          min={2}
          max={200}
          step={0.5}
          suffix="pt"
          onCommit={(fontSizePt) => remeasure({ fontSizePt })}
        />
        <NumberField
          id="text-lineheight"
          label="Line height"
          value={obj.lineHeight}
          min={0.7}
          max={3}
          step={0.05}
          onCommit={(lineHeight) => remeasure({ lineHeight })}
        />
        <NumberField
          id="text-tracking"
          label="Letter spacing"
          value={obj.letterSpacingEm}
          min={-0.2}
          max={1}
          step={0.01}
          suffix="em"
          onCommit={(letterSpacingEm) => remeasure({ letterSpacingEm })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          value={obj.align}
          aria-label="Text alignment"
          onValueChange={(v) => v && updateObject<TextObject>(obj.id, { align: v as TextObject["align"] })}
        >
          <ToggleGroupItem value="left" aria-label="Align left">
            <AlignLeft className="size-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Align center">
            <AlignCenter className="size-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Align right">
            <AlignRight className="size-4" aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={obj.textTransform}
          aria-label="Letter case"
          onValueChange={(v) =>
            v && remeasure({ textTransform: v as TextObject["textTransform"] })
          }
        >
          <ToggleGroupItem value="none" aria-label="Original case">
            Aa
          </ToggleGroupItem>
          <ToggleGroupItem value="uppercase" aria-label="Uppercase">
            AA
          </ToggleGroupItem>
          <ToggleGroupItem value="lowercase" aria-label="Lowercase">
            aa
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <FillSection
        id="text-fill"
        fill={obj.fill}
        onChange={(fill) => updateObject<TextObject>(obj.id, { fill })}
      />
      <StrokeSection
        id="text"
        stroke={obj.stroke}
        onChange={(stroke) => updateObject<TextObject>(obj.id, { stroke })}
      />
      <ShadowSection
        id="text"
        shadow={obj.shadow}
        onChange={(shadow) => updateObject<TextObject>(obj.id, { shadow })}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="text-curve" className="text-xs text-muted-foreground">
            Curved text
          </Label>
          <Switch
            id="text-curve"
            checked={obj.curve !== undefined}
            onCheckedChange={(on) => {
              if (on) {
                const radiusMm = Math.max(obj.widthMm / 2, 8);
                withGesture(() => {
                  updateObject<TextObject>(obj.id, {
                    curve: { radiusMm, direction: "up" },
                    ...curvedTextBox(radiusMm, obj.fontSizePt),
                  });
                });
              } else {
                const next = { ...obj, curve: undefined } as TextObject;
                withGesture(() => {
                  updateObject<TextObject>(obj.id, {
                    curve: undefined,
                    heightMm: measureTextHeightMm(next),
                  });
                });
              }
            }}
          />
        </div>
        {obj.curve && (
          <div className="grid grid-cols-2 gap-2">
            <DimensionField
              id="text-curve-radius"
              label="Radius"
              mm={obj.curve.radiusMm}
              min={2}
              max={300}
              onCommit={(radiusMm) =>
                withGesture(() => {
                  updateObject<TextObject>(obj.id, {
                    curve: { ...obj.curve!, radiusMm },
                    ...curvedTextBox(radiusMm, obj.fontSizePt),
                  });
                })
              }
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <ToggleGroup
                type="single"
                value={obj.curve.direction}
                aria-label="Curve direction"
                onValueChange={(v) =>
                  v &&
                  updateObject<TextObject>(obj.id, {
                    curve: { ...obj.curve!, direction: v as "up" | "down" },
                  })
                }
              >
                <ToggleGroupItem value="up" aria-label="Curve upward">
                  ⌒
                </ToggleGroupItem>
                <ToggleGroupItem value="down" aria-label="Curve downward">
                  ⌄
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function ShapeProps({ obj }: { obj: RectObject | PolygonObject | StarObject | Extract<LabelObject, { type: "ellipse" }> }) {
  return (
    <Section title="Shape">
      <FillSection
        id="shape-fill"
        fill={obj.fill}
        allowNone
        onChange={(fill) => updateObject(obj.id, { fill })}
      />
      {obj.type === "rect" && (
        <DimensionField
          id="shape-corner"
          label="Corner radius"
          mm={obj.cornerRadiusMm}
          min={0}
          max={Math.min(obj.widthMm, obj.heightMm) / 2}
          onCommit={(cornerRadiusMm) =>
            updateObject<RectObject>(obj.id, { cornerRadiusMm })
          }
        />
      )}
      {obj.type === "polygon" && (
        <NumberField
          id="shape-sides"
          label="Sides"
          value={obj.sides}
          min={3}
          max={24}
          onCommit={(sides) =>
            updateObject<PolygonObject>(obj.id, { sides: Math.round(sides) })
          }
        />
      )}
      {obj.type === "star" && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="star-points"
            label="Points"
            value={obj.points}
            min={3}
            max={24}
            onCommit={(points) =>
              updateObject<StarObject>(obj.id, { points: Math.round(points) })
            }
          />
          <NumberField
            id="star-inner"
            label="Inner ratio"
            value={obj.innerRatio}
            min={0.1}
            max={0.95}
            step={0.05}
            onCommit={(innerRatio) => updateObject<StarObject>(obj.id, { innerRatio })}
          />
        </div>
      )}
      <StrokeSection
        id="shape"
        stroke={obj.stroke}
        onChange={(stroke) => updateObject(obj.id, { stroke })}
      />
      <ShadowSection
        id="shape"
        shadow={obj.shadow}
        onChange={(shadow) => updateObject(obj.id, { shadow })}
      />
    </Section>
  );
}

function LineProps({ obj }: { obj: LineObject }) {
  return (
    <Section title="Line">
      <ColorField
        id="line-color"
        label="Color"
        color={obj.color}
        onCommit={(color) => updateObject<LineObject>(obj.id, { color })}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id="line-width"
          label="Thickness"
          value={obj.strokePt}
          min={0.25}
          max={40}
          step={0.25}
          suffix="pt"
          onCommit={(strokePt) => updateObject<LineObject>(obj.id, { strokePt })}
        />
        <div className="space-y-1">
          <Label htmlFor="line-style" className="text-xs text-muted-foreground">
            Style
          </Label>
          <Select
            value={obj.dash && obj.dash.length > 0 ? "dashed" : "solid"}
            onValueChange={(v) =>
              updateObject<LineObject>(obj.id, {
                dash: v === "dashed" ? [4, 3] : undefined,
              })
            }
          >
            <SelectTrigger id="line-style" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function PropertiesPanel({ doc }: { doc: LabelDocument }) {
  const selection = useEditorUiStore((s) => s.selection);
  const objects = React.useMemo(
    () => selection.map((id) => findObject(doc, id)).filter((o) => o !== null),
    [doc, selection],
  );

  if (objects.length === 0) {
    return <DocumentProps doc={doc} />;
  }

  const single = objects.length === 1 ? objects[0] : null;

  return (
    <>
      <CommonProps objects={objects} />
      {single && (
        <>
          <Separator />
          {single.type === "text" && <TextProps obj={single} />}
          {(single.type === "rect" ||
            single.type === "ellipse" ||
            single.type === "polygon" ||
            single.type === "star") && <ShapeProps obj={single} />}
          {single.type === "line" && <LineProps obj={single} />}
          {single.type === "image" && <ImageProps obj={single} />}
          {single.type === "qrcode" && <QrProps obj={single} />}
          {single.type === "barcode" && <BarcodeProps obj={single} />}
        </>
      )}
    </>
  );
}
