import type { BarcodeSymbology } from "@/lib/document/schema";

/**
 * Barcode payload validation (pure, unit-tested). Rendering is delegated to
 * bwip-js; these checks give users actionable errors before rendering and
 * power the preflight scannability rules.
 */

export interface CodeValidation {
  ok: boolean;
  message?: string;
  /** For EAN/UPC: payload with the check digit appended when it was omitted. */
  normalized?: string;
}

/** GS1 modulo-10 check digit for a numeric payload (without check digit). */
export function gs1CheckDigit(digits: string): number {
  let sum = 0;
  // Weights 3/1 alternating from the RIGHTMOST digit of the payload.
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

const CODE39_CHARSET = /^[0-9A-Z\-. $/+%]*$/;

export function validateBarcodeValue(
  symbology: BarcodeSymbology,
  value: string,
): CodeValidation {
  if (value.length === 0) {
    return { ok: false, message: "Enter a value to encode." };
  }

  switch (symbology) {
    case "code128": {
      // Code 128 subset B covers ASCII 32–126; bwip-js handles the rest via
      // subset switching, but control characters are a data-entry mistake.
      if ([...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126)) {
        return {
          ok: false,
          message: "Code 128 supports printable ASCII characters only.",
        };
      }
      return { ok: true, normalized: value };
    }
    case "code39": {
      const upper = value.toUpperCase();
      if (!CODE39_CHARSET.test(upper)) {
        return {
          ok: false,
          message:
            "Code 39 supports A–Z, 0–9, space, and - . $ / + % characters.",
        };
      }
      return { ok: true, normalized: upper };
    }
    case "ean13": {
      if (!/^\d+$/.test(value)) {
        return { ok: false, message: "EAN-13 requires digits only." };
      }
      if (value.length === 12) {
        return { ok: true, normalized: value + gs1CheckDigit(value) };
      }
      if (value.length === 13) {
        const expected = gs1CheckDigit(value.slice(0, 12));
        if (Number(value[12]) !== expected) {
          return {
            ok: false,
            message: `Check digit should be ${expected} (got ${value[12]}).`,
          };
        }
        return { ok: true, normalized: value };
      }
      return {
        ok: false,
        message: "EAN-13 requires 12 digits (13 with the check digit).",
      };
    }
    case "upca": {
      if (!/^\d+$/.test(value)) {
        return { ok: false, message: "UPC-A requires digits only." };
      }
      if (value.length === 11) {
        return { ok: true, normalized: value + gs1CheckDigit(value) };
      }
      if (value.length === 12) {
        const expected = gs1CheckDigit(value.slice(0, 11));
        if (Number(value[11]) !== expected) {
          return {
            ok: false,
            message: `Check digit should be ${expected} (got ${value[11]}).`,
          };
        }
        return { ok: true, normalized: value };
      }
      return {
        ok: false,
        message: "UPC-A requires 11 digits (12 with the check digit).",
      };
    }
    case "datamatrix": {
      if (value.length > 2335) {
        return { ok: false, message: "Data Matrix payload is too long." };
      }
      return { ok: true, normalized: value };
    }
  }
}
