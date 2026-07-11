import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeImposition, type ImpositionInput } from "./imposition";

const BASE: ImpositionInput = {
  pageWidthMm: 215.9, // US Letter
  pageHeightMm: 279.4,
  labelWidthMm: 73.969,
  labelHeightMm: 26,
  bleedMm: 2,
  marginMm: 10,
  spacingXMm: 3,
  spacingYMm: 3,
  offsetXMm: 0,
  offsetYMm: 0,
  copies: 20,
  startRow: 0,
  startCol: 0,
};

describe("computeImposition — known layouts", () => {
  it("fits the 10 mL wrap label 2×8 on US Letter", () => {
    const r = computeImposition(BASE);
    // Cell = 77.969 × 30; printable = 195.9 × 259.4.
    // Columns: floor((195.9+3)/(77.969+3)) = floor(2.456) = 2
    // Rows: floor((259.4+3)/(30+3)) = floor(7.95) = 7
    expect(r.columns).toBe(2);
    expect(r.rows).toBe(7);
    expect(r.perPage).toBe(14);
    expect(r.placedCount).toBe(20);
    expect(r.pageCount).toBe(2);
    expect(r.pages[0]).toHaveLength(14);
    expect(r.pages[1]).toHaveLength(6);
    expect(r.issues).toHaveLength(0);
  });

  it("centers the grid inside the margins", () => {
    const r = computeImposition(BASE);
    const gridW = r.columns * r.cellWidthMm + (r.columns - 1) * BASE.spacingXMm;
    const expectedOriginX = 10 + (195.9 - gridW) / 2;
    expect(r.originXMm).toBeCloseTo(expectedOriginX, 9);
    const first = r.pages[0]![0]!;
    expect(first.xMm).toBeCloseTo(expectedOriginX, 9);
  });

  it("applies calibration offsets to every cell", () => {
    const shifted = computeImposition({ ...BASE, offsetXMm: 1.5, offsetYMm: -2 });
    const baseline = computeImposition(BASE);
    expect(shifted.pages[0]![0]!.xMm).toBeCloseTo(
      baseline.pages[0]![0]!.xMm + 1.5,
      9,
    );
    expect(shifted.pages[0]![0]!.yMm).toBeCloseTo(
      baseline.pages[0]![0]!.yMm - 2,
      9,
    );
  });

  it("start row/col skips cells on the first page only", () => {
    const r = computeImposition({ ...BASE, startRow: 2, startCol: 1, copies: 14 });
    // Skip = 2*2 + 1 = 5 cells → 9 cells remain on page 1, 5 on page 2.
    expect(r.pages[0]).toHaveLength(9);
    expect(r.pages[1]).toHaveLength(5);
    const first = r.pages[0]![0]!;
    expect(first.row).toBe(2);
    expect(first.col).toBe(1);
    // Page 2 starts at the top-left again.
    expect(r.pages[1]![0]!.row).toBe(0);
    expect(r.pages[1]![0]!.col).toBe(0);
  });

  it("reports when the label cannot fit", () => {
    const r = computeImposition({ ...BASE, labelWidthMm: 300 });
    expect(r.perPage).toBe(0);
    expect(r.pageCount).toBe(0);
    expect(r.issues.some((i) => /larger than the printable area/i.test(i))).toBe(true);
  });

  it("warns when offsets push labels off the page", () => {
    const r = computeImposition({ ...BASE, offsetXMm: 50 });
    expect(r.issues.some((i) => /off the page/i.test(i))).toBe(true);
  });
});

describe("computeImposition — properties", () => {
  const inputArb = fc
    .record({
      pageWidthMm: fc.double({ min: 100, max: 500, noNaN: true }),
      pageHeightMm: fc.double({ min: 100, max: 500, noNaN: true }),
      labelWidthMm: fc.double({ min: 10, max: 120, noNaN: true }),
      labelHeightMm: fc.double({ min: 8, max: 120, noNaN: true }),
      bleedMm: fc.double({ min: 0, max: 4, noNaN: true }),
      marginMm: fc.double({ min: 0, max: 20, noNaN: true }),
      spacingXMm: fc.double({ min: 0, max: 10, noNaN: true }),
      spacingYMm: fc.double({ min: 0, max: 10, noNaN: true }),
      copies: fc.integer({ min: 0, max: 500 }),
      startRow: fc.integer({ min: 0, max: 20 }),
      startCol: fc.integer({ min: 0, max: 20 }),
    })
    .map((r) => ({ ...r, offsetXMm: 0, offsetYMm: 0 }) satisfies ImpositionInput);

  it("places exactly `copies` cells, all inside the page, never overlapping", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const r = computeImposition(input);
        if (r.perPage === 0) {
          expect(r.placedCount).toBe(0);
          return;
        }
        expect(r.placedCount).toBe(input.copies);

        const seen = new Set<string>();
        for (const page of r.pages) {
          for (const cell of page) {
            // Unique slot per page. Combined with the exact grid-position
            // formula below and spacing ≥ 0, uniqueness implies non-overlap.
            const key = `${cell.pageIndex}:${cell.row}:${cell.col}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
            // Position matches the grid formula exactly.
            expect(cell.xMm).toBeCloseTo(
              r.originXMm + cell.col * (r.cellWidthMm + input.spacingXMm),
              9,
            );
            expect(cell.yMm).toBeCloseTo(
              r.originYMm + cell.row * (r.cellHeightMm + input.spacingYMm),
              9,
            );
            // Within the page (offsets are zero in this property).
            expect(cell.xMm).toBeGreaterThanOrEqual(-1e-9);
            expect(cell.yMm).toBeGreaterThanOrEqual(-1e-9);
            expect(cell.xMm + r.cellWidthMm).toBeLessThanOrEqual(
              input.pageWidthMm + 1e-9,
            );
            expect(cell.yMm + r.cellHeightMm).toBeLessThanOrEqual(
              input.pageHeightMm + 1e-9,
            );
            // Row/col within grid.
            expect(cell.row).toBeLessThan(r.rows);
            expect(cell.col).toBeLessThan(r.columns);
          }
        }
      }),
      { numRuns: 150 },
    );
  }, 20_000);

  it("full pages are exactly perPage; only first and last may be partial", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const r = computeImposition(input);
        if (r.pageCount <= 1) return;
        for (let p = 1; p < r.pageCount - 1; p++) {
          expect(r.pages[p]).toHaveLength(r.perPage);
        }
        expect(r.pages[r.pageCount - 1]!.length).toBeGreaterThan(0);
        expect(r.pages[r.pageCount - 1]!.length).toBeLessThanOrEqual(r.perPage);
      }),
      { numRuns: 200 },
    );
  });
});
