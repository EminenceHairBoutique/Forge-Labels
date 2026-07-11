import { describe, expect, it } from "vitest";
import {
  formatMm,
  fromMm,
  mmToPt,
  mmToPx,
  mmToPxExact,
  parseToMm,
  ptToMm,
  pxToMm,
  roundMm,
  toMm,
} from "./units";

describe("unit conversions", () => {
  it("converts display units to mm exactly", () => {
    expect(toMm(1, "in")).toBe(25.4);
    expect(toMm(1, "cm")).toBe(10);
    expect(toMm(42, "mm")).toBe(42);
  });

  it("round-trips mm ↔ display units", () => {
    for (const unit of ["mm", "cm", "in"] as const) {
      expect(fromMm(toMm(3.75, unit), unit)).toBeCloseTo(3.75, 12);
    }
  });

  it("converts mm to PDF points using 72 pt/in", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 12);
    expect(mmToPt(210)).toBeCloseTo(595.2755905511812, 9); // A4 width
    expect(ptToMm(mmToPt(63.37))).toBeCloseTo(63.37, 12);
  });

  it("converts mm to pixels at a DPI", () => {
    expect(mmToPx(25.4, 300)).toBeCloseTo(300, 12);
    expect(mmToPx(50.8, 600)).toBeCloseTo(1200, 12);
    expect(pxToMm(mmToPx(19.3, 300), 300)).toBeCloseTo(19.3, 12);
  });

  it("emits exact integer pixel counts for exports", () => {
    // 74 mm at 300 DPI = 874.015… px → 874
    expect(mmToPxExact(74, 300)).toBe(874);
    // US Letter at 600 DPI
    expect(mmToPxExact(215.9, 600)).toBe(5100);
    expect(mmToPxExact(279.4, 600)).toBe(6600);
  });

  it("rounds stored mm to 0.001", () => {
    expect(roundMm(76.96902001)).toBe(76.969);
  });

  it("formats mm in display units", () => {
    expect(formatMm(25.4, "in")).toBe("1.000 in");
    expect(formatMm(76.969, "mm")).toBe("77.0 mm");
    expect(formatMm(76.969, "cm", { decimals: 3 })).toBe("7.697 cm");
    expect(formatMm(10, "mm", { suffix: false })).toBe("10.0");
  });

  it("parses user input with comma or dot decimals", () => {
    expect(parseToMm("1.5", "in")).toBeCloseTo(38.1, 12);
    expect(parseToMm("2,5", "cm")).toBeCloseTo(25, 12);
    expect(parseToMm("abc", "mm")).toBeNull();
    expect(parseToMm("", "mm")).toBeNull();
  });
});
