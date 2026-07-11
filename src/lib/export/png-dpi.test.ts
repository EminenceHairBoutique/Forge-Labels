import { describe, expect, it } from "vitest";
import { crc32, isPng, readPngDpi, setPngDpi } from "./png-dpi";

// Minimal valid 1×1 transparent PNG.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function tinyPng(): Uint8Array {
  return Uint8Array.from(Buffer.from(TINY_PNG_BASE64, "base64"));
}

describe("crc32", () => {
  it("matches the known CRC of 'IEND'", () => {
    const iend = new Uint8Array([0x49, 0x45, 0x4e, 0x44]);
    expect(crc32(iend)).toBe(0xae426082);
  });
});

describe("setPngDpi / readPngDpi", () => {
  it("injects a pHYs chunk readable as the requested DPI", () => {
    const png = tinyPng();
    expect(isPng(png)).toBe(true);
    expect(readPngDpi(png)).toBeNull();

    const stamped = setPngDpi(png, 300);
    expect(isPng(stamped)).toBe(true);
    expect(readPngDpi(stamped)).toBe(300);
    // 17 bytes of chunk overhead + 9 data bytes.
    expect(stamped.length).toBe(png.length + 21);
  });

  it("replaces an existing pHYs instead of duplicating", () => {
    const once = setPngDpi(tinyPng(), 300);
    const twice = setPngDpi(once, 600);
    expect(readPngDpi(twice)).toBe(600);
    expect(twice.length).toBe(once.length);
  });

  it("supports 600 DPI within integer ppm precision", () => {
    expect(readPngDpi(setPngDpi(tinyPng(), 600))).toBe(600);
  });

  it("rejects non-PNG bytes", () => {
    expect(() => setPngDpi(new Uint8Array([1, 2, 3]), 300)).toThrow(/not a png/i);
  });
});
