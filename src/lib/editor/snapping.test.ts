import { describe, expect, it } from "vitest";
import { createDocument, createShapeObject } from "@/lib/document/defaults";
import { aabbAt, collectSnapLines, nearest, snapBox } from "./snapping";

describe("nearest", () => {
  it("finds the closest value in a sorted array", () => {
    const arr = [0, 10, 20, 30];
    expect(nearest(arr, 12)).toBe(10);
    expect(nearest(arr, 16)).toBe(20);
    expect(nearest(arr, -5)).toBe(0);
    expect(nearest(arr, 99)).toBe(30);
    expect(nearest([], 5)).toBeNull();
  });
});

describe("collectSnapLines", () => {
  it("includes label edges, center, and safe zone", () => {
    const doc = createDocument(); // 73.969 × 26, safe 3
    const lines = collectSnapLines(doc, new Set());
    expect(lines.xs).toContain(0);
    expect(lines.xs).toContain(doc.label.widthMm / 2);
    expect(lines.xs).toContain(doc.label.widthMm);
    expect(lines.xs).toContain(3);
    expect(lines.ys).toContain(doc.label.heightMm - 3);
  });

  it("includes other objects but not excluded ones", () => {
    const doc = createDocument();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 4, heightMm: 4 });
    const b = createShapeObject(doc, "rect", { xMm: 30, yMm: 10, widthMm: 4, heightMm: 4 });
    doc.objects.push(a, b);
    const lines = collectSnapLines(doc, new Set([a.id]));
    expect(lines.xs).toContain(28); // b's left edge
    expect(lines.xs).not.toContain(8); // a excluded
  });
});

describe("snapBox", () => {
  const lines = { xs: [0, 50, 100], ys: [0, 25, 50] };

  it("snaps the nearest edge within the threshold", () => {
    // Box left edge at 48.6 → snaps to 50 (dx = 1.4).
    const r = snapBox(lines, { x: 48.6, y: 100, width: 10, height: 10 }, 2);
    expect(r.dx).toBeCloseTo(1.4, 9);
    expect(r.guideX).toBe(50);
    expect(r.guideY).toBeNull(); // nothing within 2mm vertically
  });

  it("prefers the closest of left/center/right", () => {
    // center at 49.5 (dist 0.5) vs left at 44.5 (dist 5.5 to 50) → center wins.
    const r = snapBox(lines, { x: 44.5, y: 0.4, width: 10, height: 10 }, 2);
    expect(r.dx).toBeCloseTo(0.5, 9);
    expect(r.dy).toBeCloseTo(-0.4, 9);
  });

  it("returns zero delta outside the threshold", () => {
    const r = snapBox(lines, { x: 30, y: 30, width: 4, height: 4 }, 1);
    expect(r.dx).toBe(0);
    expect(r.guideX).toBeNull();
  });

  it("aabbAt recomputes the box at an overridden center", () => {
    const doc = createDocument();
    const o = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 6, heightMm: 4 });
    const box = aabbAt(o, 20, 12);
    expect(box).toEqual({ x: 17, y: 10, width: 6, height: 4 });
  });
});
