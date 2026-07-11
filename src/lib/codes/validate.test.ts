import { describe, expect, it } from "vitest";
import { gs1CheckDigit, validateBarcodeValue } from "./validate";

describe("gs1CheckDigit", () => {
  it("computes known EAN-13 check digits", () => {
    // 4006381333931 is the canonical example (Stabilo pen).
    expect(gs1CheckDigit("400638133393")).toBe(1);
    // 5901234123457
    expect(gs1CheckDigit("590123412345")).toBe(7);
  });

  it("computes known UPC-A check digits", () => {
    // 036000291452 (classic UPC example)
    expect(gs1CheckDigit("03600029145")).toBe(2);
  });
});

describe("validateBarcodeValue", () => {
  it("appends the EAN-13 check digit to 12-digit payloads", () => {
    const r = validateBarcodeValue("ean13", "400638133393");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("4006381333931");
  });

  it("accepts a correct 13-digit EAN and rejects a wrong check digit", () => {
    expect(validateBarcodeValue("ean13", "4006381333931").ok).toBe(true);
    const bad = validateBarcodeValue("ean13", "4006381333930");
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/check digit should be 1/i);
  });

  it("validates UPC-A lengths and check digit", () => {
    expect(validateBarcodeValue("upca", "03600029145").normalized).toBe(
      "036000291452",
    );
    expect(validateBarcodeValue("upca", "036000291452").ok).toBe(true);
    expect(validateBarcodeValue("upca", "036000291453").ok).toBe(false);
    expect(validateBarcodeValue("upca", "12345").ok).toBe(false);
  });

  it("rejects non-numeric EAN/UPC payloads", () => {
    expect(validateBarcodeValue("ean13", "40063813339A").ok).toBe(false);
  });

  it("uppercases and validates Code 39", () => {
    const r = validateBarcodeValue("code39", "abc-123 .$/+%");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("ABC-123 .$/+%");
    expect(validateBarcodeValue("code39", "abc_123").ok).toBe(false);
  });

  it("rejects control characters in Code 128", () => {
    expect(validateBarcodeValue("code128", "Lot-42/B").ok).toBe(true);
    expect(validateBarcodeValue("code128", "bad\u0007bell").ok).toBe(false);
  });

  it("rejects empty payloads", () => {
    expect(validateBarcodeValue("code128", "").ok).toBe(false);
  });
});
