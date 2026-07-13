"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Moon, RectangleHorizontal, Rotate3d, Sun } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import { getMaterial } from "@/lib/easy/materials";
import { useLabelTexture } from "@/components/mockup/use-label-texture";
import {
  DEFAULT_MOCKUP_SETTINGS,
  type MockupSettings,
} from "@/components/mockup/vial-scene";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const VialScene = dynamic(
  () => import("@/components/mockup/vial-scene").then((m) => m.VialScene),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/**
 * The Easy Creator's centerpiece: the label ON the vial, live, with the
 * simplest possible controls — front/side/back, spin, light/dark backdrop,
 * and a flat-label toggle. Falls back to the flat render without WebGL.
 */

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const VIEWS = [
  { label: "Front", azimuth: 0 },
  { label: "Side", azimuth: 95 },
  { label: "Back", azimuth: 180 },
] as const;

export function VialStage({
  doc,
  className,
}: {
  doc: LabelDocument;
  className?: string;
}) {
  const labelCanvas = useLabelTexture(doc);
  const [webgl] = React.useState(() =>
    typeof document === "undefined" ? true : supportsWebGl(),
  );
  const [flat, setFlat] = React.useState(false);
  const [spin, setSpin] = React.useState(false);
  const [backdrop, setBackdrop] = React.useState<MockupSettings["backdrop"]>("light");
  // A view click sets a fresh object so repeat clicks re-snap.
  const [view, setView] = React.useState<{ azimuth: number; nonce: number } | null>(null);

  const settings: MockupSettings = {
    ...DEFAULT_MOCKUP_SETTINGS,
    backdrop,
    autoRotate: spin,
  };

  const show3d = webgl && !flat;
  // Glossy/matte materials change the label's REFLECTIVITY on the vial,
  // never the artwork colors — the "finish vs. design color" separation.
  const sheen = doc.easy
    ? (getMaterial(doc.easy.materialId)?.rules.sheen ?? "standard")
    : "standard";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-canvas-backdrop">
        {show3d ? (
          <VialScene
            vial={doc.vial}
            labelWidthMm={doc.label.widthMm}
            labelHeightMm={doc.label.heightMm}
            labelCanvas={labelCanvas}
            settings={settings}
            // The imperceptible nonce offset re-triggers the snap effect on
            // repeat clicks of the same view button.
            viewAzimuthDeg={view ? view.azimuth + view.nonce * 1e-4 : undefined}
            labelSheen={sheen}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            {labelCanvas ? (
              // eslint-disable-next-line @next/next/no-img-element -- live preview
              <img
                src={labelCanvas.toDataURL()}
                alt="Flat label preview"
                className="max-h-full max-w-full rounded shadow-lg"
              />
            ) : (
              <Skeleton className="h-32 w-4/5" />
            )}
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-muted-foreground">
          Preview is a simulation
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {VIEWS.map((v) => (
          <Button
            key={v.label}
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            disabled={!show3d}
            onClick={() => {
              setSpin(false);
              setView((prev) => ({ azimuth: v.azimuth, nonce: (prev?.nonce ?? 0) + 1 }));
            }}
          >
            {v.label}
          </Button>
        ))}
        <Button
          variant={spin ? "primary" : "outline"}
          size="sm"
          className="h-8 px-2.5 text-xs"
          disabled={!show3d}
          aria-pressed={spin}
          onClick={() => setSpin((s) => !s)}
        >
          <Rotate3d className="size-3.5" aria-hidden /> Spin
        </Button>
        <span className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          aria-label={backdrop === "light" ? "Dark background" : "Light background"}
          disabled={!show3d}
          onClick={() => setBackdrop((b) => (b === "light" ? "dark" : "light"))}
        >
          {backdrop === "light" ? (
            <Moon className="size-3.5" aria-hidden />
          ) : (
            <Sun className="size-3.5" aria-hidden />
          )}
        </Button>
        {webgl && (
          <Button
            variant={flat ? "primary" : "outline"}
            size="sm"
            className="h-8 px-2.5 text-xs"
            aria-pressed={flat}
            onClick={() => setFlat((f) => !f)}
          >
            <RectangleHorizontal className="size-3.5" aria-hidden /> Flat
          </Button>
        )}
      </div>
    </div>
  );
}
