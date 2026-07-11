"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { getTemplate } from "@/lib/templates/registry";
import { useLabelTexture } from "@/components/mockup/use-label-texture";
import { VialGraphic } from "@/components/marketing/vial-graphic";

const VialScene = dynamic(
  () => import("@/components/mockup/vial-scene").then((m) => m.VialScene),
  { ssr: false, loading: () => <VialTrioFallback /> },
);

function VialTrioFallback() {
  return (
    <div className="flex items-end justify-center gap-6 md:justify-end">
      <VialGraphic size="10ml" variant="gold" brand="NOIR" product="Formula 01" className="w-24 sm:w-28" />
      <VialGraphic size="30ml" variant="violet" brand="AURELIS" product="Serum No. 4" className="w-36 sm:w-44" />
      <VialGraphic size="20ml" variant="teal" brand="ORIGIN" product="Renew Drops" className="w-28 sm:w-32" />
    </div>
  );
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Landing hero: a live, slowly rotating 3D vial rendered through the real
 * mockup pipeline, wearing a real template from the library. Falls back to
 * the SVG illustration trio while loading or without WebGL.
 */
export function HeroVial() {
  const template = getTemplate("nova-gradient-serum") ?? null;
  const [ready, setReady] = React.useState(false);
  const [webgl, setWebgl] = React.useState(true);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    // Defer the WebGL probe and the three.js chunk until after first paint.
    const activate = () => {
      setWebgl(supportsWebGl());
      setReducedMotion(matchMedia("(prefers-reduced-motion: reduce)").matches);
      setReady(true);
    };
    const idle =
      "requestIdleCallback" in window
        ? requestIdleCallback(activate, { timeout: 1200 })
        : setTimeout(activate, 350);
    return () => {
      if (typeof idle === "number" && "cancelIdleCallback" in window) {
        cancelIdleCallback(idle);
      } else {
        clearTimeout(idle as ReturnType<typeof setTimeout>);
      }
    };
  }, []);

  const labelCanvas = useLabelTexture(ready && webgl ? (template?.doc ?? null) : null);

  if (!template || !webgl || !ready) return <VialTrioFallback />;

  return (
    <div className="relative h-96 w-full max-w-md md:justify-self-end">
      <VialScene
        vial={template.doc.vial}
        labelWidthMm={template.doc.label.widthMm}
        labelHeightMm={template.doc.label.heightMm}
        labelCanvas={labelCanvas}
        settings={{
          lighting: "studio",
          backdrop: "transparent",
          autoRotate: !reducedMotion,
        }}
        className="h-full w-full"
      />
      <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">
        Drag to rotate — a real template from the library
      </p>
    </div>
  );
}
