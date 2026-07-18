import { describe, expect, it } from "vitest";
import {
  MAX_FIELD_ROWS,
  parseFieldRows,
  sanitizeFieldRows,
  sha256Hex,
} from "./verify-core";

describe("verify-core", () => {
  it("sanitizeFieldRows trims, drops empties, and caps counts", () => {
    const rows = sanitizeFieldRows([
      { label: "  Storage  ", value: "  2–8 °C  " },
      { label: "", value: "orphan value" },
      { label: "orphan label", value: "   " },
      ...Array.from({ length: 30 }, (_, i) => ({
        label: `Row ${i}`,
        value: `v${i}`,
      })),
    ]);
    expect(rows[0]).toEqual({ label: "Storage", value: "2–8 °C" });
    expect(rows).toHaveLength(MAX_FIELD_ROWS);
    // Values are never rewritten beyond whitespace — the owner's words stand.
    expect(rows[1]).toEqual({ label: "Row 0", value: "v0" });
  });

  it("parseFieldRows keeps well-formed entries and ignores junk", () => {
    expect(
      parseFieldRows([
        { label: "Purity statement", value: "as supplied by owner" },
        { label: 42, value: "bad" },
        "nope",
        null,
      ]),
    ).toEqual([{ label: "Purity statement", value: "as supplied by owner" }]);
    expect(parseFieldRows("not-an-array")).toEqual([]);
  });

  it("sha256Hex matches the known test vector", async () => {
    const bytes = new TextEncoder().encode("abc");
    await expect(sha256Hex(bytes)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
