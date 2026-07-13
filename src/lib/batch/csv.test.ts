import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { MAX_BATCH_ROWS, parseCsv } from "./csv";

/** Minimal RFC-4180 encoder used to round-trip random matrices. */
function encodeCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((field) =>
          /[",\n\r]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field,
        )
        .join(","),
    )
    .join("\r\n");
}

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const result = parseCsv("lot,expiry\nA1,2027-01\nB2,2027-02\n");
    expect(result.headers).toEqual(["lot", "expiry"]);
    expect(result.rows).toEqual([
      ["A1", "2027-01"],
      ["B2", "2027-02"],
    ]);
    expect(result.errors).toEqual([]);
  });

  it("handles quoted fields with commas, quotes, and newlines", () => {
    const result = parseCsv('name,note\n"Vial, 10ml","She said ""go""\nnew line"');
    expect(result.rows[0]).toEqual(["Vial, 10ml", 'She said "go"\nnew line']);
  });

  it("strips a BOM and accepts CR-only line endings", () => {
    const result = parseCsv("﻿a,b\r1,2\r3,4");
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toHaveLength(2);
  });

  it("sniffs semicolon delimiters from the header line", () => {
    const result = parseCsv("lot;expiry\nA1;2027-01");
    expect(result.headers).toEqual(["lot", "expiry"]);
    expect(result.rows[0]).toEqual(["A1", "2027-01"]);
  });

  it("pads ragged rows with an error entry", () => {
    const result = parseCsv("a,b,c\n1,2\n1,2,3,4");
    expect(result.rows).toEqual([
      ["1", "2", ""],
      ["1", "2", "3"],
    ]);
    expect(result.errors).toHaveLength(2);
  });

  it("dedupes duplicate headers", () => {
    const result = parseCsv("lot,lot\n1,2");
    expect(result.headers).toEqual(["lot", "lot_2"]);
    expect(result.errors.some((e) => e.message.includes("Duplicate header"))).toBe(true);
  });

  it("truncates past the row cap", () => {
    const lines = ["n", ...Array.from({ length: MAX_BATCH_ROWS + 5 }, (_, i) => String(i))];
    const result = parseCsv(lines.join("\n"));
    expect(result.rows).toHaveLength(MAX_BATCH_ROWS);
    expect(result.truncated).toBe(true);
  });

  it("skips blank lines and a trailing newline", () => {
    const result = parseCsv("a\n1\n\n2\n");
    expect(result.rows).toEqual([["1"], ["2"]]);
  });

  it("round-trips arbitrary field matrices (property)", () => {
    const field = fc.string({ maxLength: 12 });
    fc.assert(
      fc.property(
        fc
          .record({
            cols: fc.integer({ min: 1, max: 5 }),
            rowCount: fc.integer({ min: 1, max: 8 }),
          })
          .chain(({ cols, rowCount }) =>
            fc.tuple(
              // Headers: simple unique names to sidestep trim/dedup rules.
              fc.constant(Array.from({ length: cols }, (_, i) => `col${i + 1}`)),
              fc.array(fc.array(field, { minLength: cols, maxLength: cols }), {
                minLength: rowCount,
                maxLength: rowCount,
              }),
            ),
          ),
        ([headers, rows]) => {
          // Fully-empty rows are intentionally skipped by the parser.
          const expected = rows.filter((r) => !r.every((f) => f === ""));
          const parsed = parseCsv(encodeCsv([headers, ...rows]));
          expect(parsed.headers).toEqual(headers);
          expect(parsed.rows).toEqual(expected);
        },
      ),
      { numRuns: 150 },
    );
  });
});
