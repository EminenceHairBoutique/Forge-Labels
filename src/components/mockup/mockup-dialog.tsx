"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Camera } from "lucide-react";
import type { LabelDocument, VialSpec } from "@/lib/document/schema";
import { updateVial } from "@/lib/document/commands";
import { getStorageAdapter } from "@/lib/storage";
import { useProjectSessionStore } from "@/stores/project-session-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useLabelTexture } from "./use-label-texture";
import {
  DEFAULT_MOCKUP_SETTINGS,
  type MockupSettings,
  type VialSceneHandle,
} from "./vial-scene";

/** three.js is ~700 KB — load the scene only when the preview opens. */
const VialScene = dynamic(
  () => import("./vial-scene").then((m) => m.VialScene),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

const GLASS_OPTIONS: { value: VialSpec["glass"]; label: string }[] = [
  { value: "clear", label: "Clear glass" },
  { value: "amber", label: "Amber glass" },
  { value: "cobalt", label: "Cobalt blue" },
  { value: "frosted", label: "Frosted" },
  { value: "opaque", label: "Opaque white" },
];

const CAP_OPTIONS: { value: VialSpec["capStyle"]; label: string }[] = [
  { value: "screw", label: "Screw cap" },
  { value: "crimp", label: "Crimp seal" },
  { value: "flip-off", label: "Flip-off cap" },
  { value: "dropper", label: "Dropper" },
  { value: "pump", label: "Pump" },
  { value: "none", label: "No cap" },
];

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

interface MockupDialogProps {
  doc: LabelDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MockupDialog({ doc, open, onOpenChange }: MockupDialogProps) {
  const [settings, setSettings] = React.useState<MockupSettings>(DEFAULT_MOCKUP_SETTINGS);
  const sceneRef = React.useRef<VialSceneHandle>(null);
  const labelCanvas = useLabelTexture(open ? doc : null);
  const projectName = useProjectSessionStore((s) => s.projectName);
  const projectId = useProjectSessionStore((s) => s.projectId);
  const [webgl] = React.useState(() =>
    typeof document === "undefined" ? true : supportsWebGl(),
  );

  const vial = doc.vial;

  async function snapshot() {
    const dataUrl = sceneRef.current?.snapshot();
    if (!dataUrl) {
      toast.error("Couldn't capture the mockup");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    const fileName = `${projectName.replaceAll(/\s+/g, "-").toLowerCase() || "label"}-mockup.png`;
    a.download = fileName;
    a.click();
    const byteSize = Math.round((dataUrl.length - "data:image/png;base64,".length) * 0.75);
    await getStorageAdapter().recordExport({
      projectId,
      projectName,
      kind: "mockup",
      fileName,
      byteSize,
      dpi: null,
    });
    toast.success("Mockup image saved");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Preview on vial</DialogTitle>
          <DialogDescription>
            Drag to rotate, scroll to zoom. Rendering is a simulation — glass,
            lighting, and materials will differ physically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="h-105 overflow-hidden rounded-xl border border-border">
            {webgl ? (
              <VialScene
                ref={sceneRef}
                vial={vial}
                labelWidthMm={doc.label.widthMm}
                labelHeightMm={doc.label.heightMm}
                labelCanvas={labelCanvas}
                settings={settings}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas-backdrop p-6 text-center">
                {labelCanvas && (
                  // eslint-disable-next-line @next/next/no-img-element -- canvas preview
                  <img
                    src={labelCanvas.toDataURL()}
                    alt="Flat label preview"
                    className="max-h-48 rounded shadow"
                  />
                )}
                <p className="max-w-xs text-xs text-muted-foreground">
                  3D preview needs WebGL, which isn&apos;t available in this
                  browser — showing the flat label instead.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Glass</Label>
              <Select
                value={vial.glass}
                onValueChange={(glass) => updateVial({ glass: glass as VialSpec["glass"] })}
              >
                <SelectTrigger className="h-8">
                  {GLASS_OPTIONS.find((o) => o.value === vial.glass)?.label}
                </SelectTrigger>
                <SelectContent>
                  {GLASS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cap style</Label>
              <Select
                value={vial.capStyle}
                onValueChange={(capStyle) =>
                  updateVial({ capStyle: capStyle as VialSpec["capStyle"] })
                }
              >
                <SelectTrigger className="h-8">
                  {CAP_OPTIONS.find((o) => o.value === vial.capStyle)?.label}
                </SelectTrigger>
                <SelectContent>
                  {CAP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="mock-cap-color" className="text-xs text-muted-foreground">
                  Cap color
                </Label>
                <input
                  id="mock-cap-color"
                  type="color"
                  value={vial.capColor}
                  onChange={(e) => updateVial({ capColor: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded-md border border-input bg-surface p-0.5"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mock-liquid-color" className="text-xs text-muted-foreground">
                  Liquid color
                </Label>
                <input
                  id="mock-liquid-color"
                  type="color"
                  value={vial.liquidColor}
                  onChange={(e) => updateVial({ liquidColor: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded-md border border-input bg-surface p-0.5"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Fill level</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(vial.liquidFill * 100)}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[Math.round(vial.liquidFill * 100)]}
                onValueChange={([v]) => updateVial({ liquidFill: (v ?? 65) / 100 })}
                aria-label="Liquid fill level"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lighting</Label>
              <Select
                value={settings.lighting}
                onValueChange={(lighting) =>
                  setSettings((s) => ({ ...s, lighting: lighting as MockupSettings["lighting"] }))
                }
              >
                <SelectTrigger className="h-8 capitalize">{settings.lighting}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="soft">Soft</SelectItem>
                  <SelectItem value="dramatic">Dramatic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Backdrop</Label>
              <Select
                value={settings.backdrop}
                onValueChange={(backdrop) =>
                  setSettings((s) => ({ ...s, backdrop: backdrop as MockupSettings["backdrop"] }))
                }
              >
                <SelectTrigger className="h-8 capitalize">{settings.backdrop}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {webgl && (
              <Button className="w-full" variant="outline" onClick={() => void snapshot()}>
                <Camera className="size-4" aria-hidden />
                Save mockup image
              </Button>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              The label wraps at true scale — the gap you see is your real seam
              gap. Vial style settings save with the project.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
