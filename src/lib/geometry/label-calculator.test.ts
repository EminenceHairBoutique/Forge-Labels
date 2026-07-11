import { describe, expect, it } from "vitest";
import {
  calculateLabel,
  circumference,
  DEFAULT_BLEED_MM,
  DEFAULT_SAFE_MM,
} from "./label-calculator";

const TEN_ML_SERUM = { diameterMm: 24.5, straightWallHeightMm: 30 };

describe("circumference", () => {
  it("is diameter × π", () => {
    expect(circumference(24.5)).toBeCloseTo(76.96902001, 6);
    expect(circumference(30)).toBeCloseTo(94.24777961, 6);
  });
});

describe("full-wrap labels", () => {
  it("computes width = circumference − gap and default height = wall − margin", () => {
    const r = calculateLabel({ ...TEN_ML_SERUM, style: "full-wrap", gapMm: 3 });
    expect(r.widthMm).toBeCloseTo(76.96902001 - 3, 6);
    expect(r.heightMm).toBe(26); // 30 − 4 mm default vertical margin
    expect(r.seamGapMm).toBe(3);
    expect(r.panels).toBe(1);
    expect(r.coverageRatio).toBeGreaterThan(0.9);
    expect(r.issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("applies default bleed and safe zones to canvas + safe sizes", () => {
    const r = calculateLabel({ ...TEN_ML_SERUM, style: "full-wrap" });
    expect(r.bleedMm).toBe(DEFAULT_BLEED_MM);
    expect(r.safeMm).toBe(DEFAULT_SAFE_MM);
    expect(r.totalWidthMm).toBeCloseTo(r.widthMm + 2 * DEFAULT_BLEED_MM, 9);
    expect(r.totalHeightMm).toBeCloseTo(r.heightMm + 2 * DEFAULT_BLEED_MM, 9);
    expect(r.safeWidthMm).toBeCloseTo(r.widthMm - 2 * DEFAULT_SAFE_MM, 9);
    expect(r.safeHeightMm).toBeCloseTo(r.heightMm - 2 * DEFAULT_SAFE_MM, 9);
  });

  it("warns on overlap (negative gap)", () => {
    const r = calculateLabel({ ...TEN_ML_SERUM, style: "full-wrap", gapMm: -4 });
    expect(r.widthMm).toBeCloseTo(circumference(24.5) + 4, 6);
    expect(r.issues.find((i) => i.code === "overlap-seam")?.severity).toBe("warning");
  });

  it("warns on a tight seam gap below 2 mm", () => {
    const r = calculateLabel({ ...TEN_ML_SERUM, style: "full-wrap", gapMm: 1 });
    expect(r.issues.some((i) => i.code === "tight-seam")).toBe(true);
  });

  it("notes very wide gaps", () => {
    const r = calculateLabel({ ...TEN_ML_SERUM, style: "full-wrap", gapMm: 12 });
    expect(r.issues.some((i) => i.code === "wide-gap")).toBe(true);
  });

  it("errors when the height override exceeds the straight wall", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "full-wrap",
      heightMm: 34,
    });
    expect(r.issues.find((i) => i.code === "height-exceeds-wall")?.severity).toBe(
      "error",
    );
  });

  it("always reminds the user to measure the actual vial", () => {
    const r = calculateLabel({ ...TEN_ML_SERUM, style: "full-wrap" });
    expect(r.issues.some((i) => i.code === "measure-vial")).toBe(true);
  });

  it("warns about tight curvature on very thin vials", () => {
    const r = calculateLabel({
      diameterMm: 12,
      straightWallHeightMm: 30,
      style: "full-wrap",
    });
    expect(r.issues.some((i) => i.code === "tight-curvature")).toBe(true);
  });
});

describe("partial-wrap labels", () => {
  it("covers the requested fraction of the circumference", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "partial-wrap",
      coverageRatio: 0.5,
    });
    expect(r.widthMm).toBeCloseTo(circumference(24.5) / 2, 6);
    expect(r.coverageRatio).toBeCloseTo(0.5, 9);
    expect(r.seamGapMm).toBeCloseTo(circumference(24.5) / 2, 6);
  });
});

describe("front-only and front-back labels", () => {
  it("front-only uses the panel ratio", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "front-only",
      panelRatio: 0.4,
    });
    expect(r.widthMm).toBeCloseTo(circumference(24.5) * 0.4, 6);
    expect(r.panels).toBe(1);
  });

  it("front-back doubles the coverage and reports 2 panels", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "front-back",
      panelRatio: 0.35,
    });
    expect(r.panels).toBe(2);
    expect(r.coverageRatio).toBeCloseTo(0.7, 9);
  });

  it("clamps the panel ratio to half the circumference", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "front-only",
      panelRatio: 0.9,
    });
    expect(r.widthMm).toBeCloseTo(circumference(24.5) * 0.5, 6);
  });
});

describe("neck bands and cap stickers", () => {
  it("neck band wraps the neck diameter with a built-in overlap", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "neck-band",
      neckDiameterMm: 20,
      neckBandHeightMm: 12,
    });
    expect(r.circumferenceMm).toBeCloseTo(circumference(20), 6);
    expect(r.widthMm).toBeCloseTo(circumference(20) + 5, 6);
    expect(r.heightMm).toBe(12);
    expect(r.seamGapMm).toBe(-5);
  });

  it("cap sticker is a circle inset from the cap edge", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "cap-circle",
      capDiameterMm: 20,
    });
    expect(r.widthMm).toBe(18);
    expect(r.heightMm).toBe(18);
  });
});

describe("validation", () => {
  it("rejects non-positive diameters", () => {
    const r = calculateLabel({
      diameterMm: 0,
      straightWallHeightMm: 30,
      style: "full-wrap",
    });
    expect(r.issues.find((i) => i.code === "invalid-diameter")?.severity).toBe(
      "error",
    );
    expect(r.widthMm).toBe(0);
  });

  it("rejects a gap larger than the circumference", () => {
    const r = calculateLabel({
      ...TEN_ML_SERUM,
      style: "full-wrap",
      gapMm: 100,
    });
    expect(r.issues.find((i) => i.code === "invalid-result")?.severity).toBe(
      "error",
    );
  });

  it("recommends 600 DPI for small labels and 300 otherwise", () => {
    const small = calculateLabel({
      diameterMm: 12,
      straightWallHeightMm: 20,
      style: "full-wrap",
    });
    expect(small.recommendedDpi).toBe(600);

    const normal = calculateLabel({
      diameterMm: 34.5,
      straightWallHeightMm: 45,
      style: "full-wrap",
    });
    expect(normal.recommendedDpi).toBe(300);
  });
});
