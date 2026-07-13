import { describe, expect, it } from "vitest";
import type { PathCommand } from "fontkit";
import { createQrMatrix } from "@/lib/codes/qr";
import {
  barcodeBoxTransform,
  ellipsePathData,
  parseSvgPaths,
  pointsPathData,
  polygonPointsMm,
  qrDotModulesPathData,
  qrRoundedModulesPathData,
  qrSquareRunsPathData,
  rectPathData,
  starPointsMm,
  transformedGlyphPathData,
} from "./vector-paths";

describe("rectPathData", () => {
  it("emits a plain rectangle when the radius is zero", () => {
    expect(rectPathData(10, 6, 0, false)).toBe("M0 0H10V6H0Z");
  });

  it("centers the origin on request", () => {
    expect(rectPathData(10, 6, 0, true)).toBe("M-5 -3H5V3H-5Z");
  });

  it("uses arc corners for rounded rects and clamps the radius", () => {
    const d = rectPathData(10, 6, 2, false);
    expect(d).toContain("A2 2 0 0 1");
    // Radius can never exceed half the short side.
    const clamped = rectPathData(10, 6, 50, false);
    expect(clamped).toContain("A3 3 0 0 1");
  });
});

describe("ellipsePathData", () => {
  it("draws two arcs around the center", () => {
    expect(ellipsePathData(5, 3)).toBe("M-5 0A5 3 0 1 0 5 0A5 3 0 1 0 -5 0Z");
  });
});

describe("pointsPathData", () => {
  it("closes the polygon", () => {
    const d = pointsPathData([
      { x: 0, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 },
    ]);
    expect(d).toBe("M0 -5L5 5L-5 5Z");
  });

  it("round-trips polygon and star vertex generators", () => {
    const poly = pointsPathData(polygonPointsMm({ widthMm: 10, heightMm: 10, sides: 4 }));
    expect(poly.startsWith("M0 -5")).toBe(true);
    const star = pointsPathData(
      starPointsMm({ widthMm: 10, heightMm: 10, points: 5, innerRatio: 0.5 }),
    );
    expect(star.split("L")).toHaveLength(10); // 10 vertices: M + 9 L
  });
});

describe("transformedGlyphPathData", () => {
  const commands: PathCommand[] = [
    { command: "moveTo", args: [0, 0] } as PathCommand,
    { command: "lineTo", args: [100, 0] } as PathCommand,
    { command: "closePath", args: [] } as PathCommand,
  ];

  it("applies scale and the y-flip with no rotation", () => {
    // scale 0.01: 100 font units → 1 mm; oy − y·scale keeps y-down.
    const d = transformedGlyphPathData(commands, 0.01, 0, 0, 0, 0, 0);
    expect(d).toBe("M0 0L1 0Z");
  });

  it("bakes a 90° clockwise rotation plus translation", () => {
    const d = transformedGlyphPathData(commands, 0.01, 0, 0, 90, 10, 20);
    // (1, 0) rotated 90° clockwise in y-down space → (0, 1), then +(10, 20).
    expect(d).toBe("M10 20L10 21Z");
  });
});

describe("QR module path builders", () => {
  const matrix = createQrMatrix("https://example.com", "M");

  it("merges horizontal runs in square mode", () => {
    const d = qrSquareRunsPathData(matrix, 4);
    expect(d.startsWith("M")).toBe(true);
    // Finder patterns guarantee a run of 7 somewhere.
    expect(d).toContain("h7v1h-7z");
  });

  it("emits rounded and dot variants as arc paths", () => {
    expect(qrRoundedModulesPathData(matrix, 4)).toContain("a0.3 0.3 0 0 1");
    expect(qrDotModulesPathData(matrix, 4)).toContain("A0.425 0.425 0 1 0");
  });
});

describe("parseSvgPaths", () => {
  it("parses viewBox and path elements", () => {
    const parsed = parseSvgPaths(
      `<svg viewBox="0 0 100 40"><path d="M0 0h10v40h-10z" fill="#111111"/>` +
        `<path d="M20 0h5v40h-5z" fill="#111111"/></svg>`,
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.viewBox).toEqual({ minX: 0, minY: 0, width: 100, height: 40 });
    expect(parsed!.paths).toHaveLength(2);
    expect(parsed!.paths[0]!.fill).toBe("#111111");
  });

  it("rejects output containing non-path elements", () => {
    expect(
      parseSvgPaths(`<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`),
    ).toBeNull();
  });

  it("rejects transformed groups (geometry would shift silently)", () => {
    expect(
      parseSvgPaths(
        `<svg viewBox="0 0 10 10"><g transform="translate(2 2)"><path d="M0 0h1v1z"/></g></svg>`,
      ),
    ).toBeNull();
  });

  it("accepts untransformed groups", () => {
    const parsed = parseSvgPaths(
      `<svg viewBox="0 0 10 10"><g fill="#000"><path d="M0 0h1v1z" fill="#000000"/></g></svg>`,
    );
    expect(parsed?.paths).toHaveLength(1);
  });
});

describe("barcodeBoxTransform", () => {
  const viewBox = { minX: 0, minY: 0, width: 200, height: 100 };

  it("stretches 1D codes to fill the box", () => {
    const t = barcodeBoxTransform(
      { symbology: "code128", widthMm: 40, heightMm: 15 },
      viewBox,
    );
    expect(t.sx).toBeCloseTo(0.2, 10);
    expect(t.sy).toBeCloseTo(0.15, 10);
    expect(t.txMm).toBeCloseTo(0, 10);
  });

  it("keeps Data Matrix square and centered", () => {
    const t = barcodeBoxTransform(
      { symbology: "datamatrix", widthMm: 40, heightMm: 15 },
      { minX: 0, minY: 0, width: 100, height: 100 },
    );
    expect(t.sx).toBe(t.sy);
    expect(t.sx).toBeCloseTo(0.15, 10);
    expect(t.txMm).toBeCloseTo((40 - 15) / 2, 10);
    expect(t.tyMm).toBeCloseTo(0, 10);
  });

  it("folds a nonzero viewBox origin into the translation", () => {
    const t = barcodeBoxTransform(
      { symbology: "code128", widthMm: 20, heightMm: 10 },
      { minX: 5, minY: 2, width: 100, height: 50 },
    );
    expect(t.txMm).toBeCloseTo(-5 * 0.2, 10);
    expect(t.tyMm).toBeCloseTo(-2 * 0.2, 10);
  });
});
