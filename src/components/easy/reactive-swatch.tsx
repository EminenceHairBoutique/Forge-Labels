"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Interactive shine layer for holographic/metallic cards: the highlight
 * follows the pointer (or finger) across the swatch, and on devices that
 * expose orientation events without a permission prompt, tilting the phone
 * moves it too — so "changes as it moves" is something you FEEL before you
 * buy the material. Honors prefers-reduced-motion (the FinishSwatch's
 * static tile remains underneath; this is decoration only).
 */
export function ReactiveShine({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(false);

  const setShine = React.useCallback((xPct: number, yPct: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--shine-x", `${xPct}%`);
    el.style.setProperty("--shine-y", `${yPct}%`);
  }, []);

  React.useEffect(() => {
    // Tilt-to-shine where orientation events flow without a permission
    // dialog (Android, some desktops). iOS requires a user-gesture prompt —
    // there, pointer/touch tracking below covers the interaction instead.
    type OrientationCtor = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<string>;
    };
    const ctor =
      typeof DeviceOrientationEvent !== "undefined"
        ? (DeviceOrientationEvent as OrientationCtor)
        : null;
    if (!ctor || typeof ctor.requestPermission === "function") return;

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      const x = Math.min(Math.max((event.gamma + 45) / 90, 0), 1) * 100;
      const y = Math.min(Math.max(event.beta / 90, 0), 1) * 100;
      setShine(x, y);
      setActive(true);
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [setShine]);

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setShine(
          ((e.clientX - rect.left) / rect.width) * 100,
          ((e.clientY - rect.top) / rect.height) * 100,
        );
        setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-md transition-opacity duration-300 motion-reduce:hidden",
          active ? "opacity-100" : "opacity-0",
        )}
        style={{
          background:
            "radial-gradient(circle at var(--shine-x, 50%) var(--shine-y, 40%), rgb(255 255 255 / 0.55), rgb(255 255 255 / 0.12) 35%, transparent 65%)",
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
}
