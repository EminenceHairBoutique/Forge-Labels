import { describe, expect, it } from "vitest";
import type { GroupObject, LabelDocument, LabelObject } from "@/lib/document/schema";
import { createDocument } from "@/lib/document/defaults";
import { barcode, qr, rect, text } from "@/lib/templates/authoring";
import { extractTokens, hasTokens, substituteTokens, uniqueTokens } from "./tokens";

function makeDoc(objects: LabelObject[]): LabelDocument {
  return { ...createDocument(), objects };
}

describe("hasTokens", () => {
  it("matches {{name}} with flexible inner whitespace", () => {
    expect(hasTokens("Lot {{lot}}")).toBe(true);
    expect(hasTokens("{{ lot number }}")).toBe(true);
    expect(hasTokens("no tokens")).toBe(false);
    expect(hasTokens("{single} {{}} {{ }}")).toBe(false);
  });
});

describe("extractTokens", () => {
  it("finds tokens across text, QR, and barcode fields, into groups", () => {
    const group: GroupObject = {
      id: "g",
      type: "group",
      name: "Group",
      xMm: 20,
      yMm: 10,
      widthMm: 20,
      heightMm: 10,
      rotationDeg: 0,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      children: [
        text({ id: "t2", text: "Exp {{expiry}}", xMm: 5, yMm: 5, widthMm: 10, fontSizePt: 6 }),
      ],
    };
    const doc = makeDoc([
      text({ id: "t1", text: "Lot {{lot}} of {{lot}}", xMm: 10, yMm: 5, widthMm: 20, fontSizePt: 8 }),
      qr({ id: "q", value: "https://x.example/{{sku}}", xMm: 40, yMm: 10, widthMm: 12 }),
      barcode({ id: "b", value: "{{ean}}", xMm: 60, yMm: 10, widthMm: 20, heightMm: 10, symbology: "ean13" }),
      rect({ id: "r", xMm: 30, yMm: 20, widthMm: 5, heightMm: 5 }),
      group,
    ]);
    const refs = extractTokens(doc);
    expect(refs.map((r) => `${r.field}:${r.token}`)).toEqual([
      "text:lot",
      "text:lot",
      "qr-value:sku",
      "barcode-value:ean",
      "text:expiry",
    ]);
    expect(uniqueTokens(refs)).toEqual(["lot", "sku", "ean", "expiry"]);
  });
});

describe("substituteTokens", () => {
  const doc = makeDoc([
    text({ id: "t", text: "Lot {{lot}} — {{ LOT }}", xMm: 10, yMm: 5, widthMm: 30, fontSizePt: 8 }),
    qr({ id: "q", value: "https://x.example/{{sku}}", xMm: 40, yMm: 10, widthMm: 12 }),
    rect({ id: "r", xMm: 30, yMm: 20, widthMm: 5, heightMm: 5 }),
  ]);

  it("replaces tokens case- and whitespace-insensitively", () => {
    const out = substituteTokens(doc, { lot: "A42", sku: "X1" });
    const t = out.objects[0] as { text: string };
    const q = out.objects[1] as { value: string };
    expect(t.text).toBe("Lot A42 — A42");
    expect(q.value).toBe("https://x.example/X1");
  });

  it("is pure and structurally shares untouched objects", () => {
    const out = substituteTokens(doc, { lot: "A42", sku: "X1" });
    expect(out).not.toBe(doc);
    expect((doc.objects[0] as { text: string }).text).toContain("{{lot}}");
    expect(out.objects[2]).toBe(doc.objects[2]); // untouched rect: same ref
  });

  it("leaves unknown tokens literal", () => {
    const out = substituteTokens(doc, { sku: "X1" });
    expect((out.objects[0] as { text: string }).text).toBe("Lot {{lot}} — {{ LOT }}");
  });

  it("returns the same document when nothing matches", () => {
    const plain = makeDoc([rect({ id: "r", xMm: 10, yMm: 10, widthMm: 5, heightMm: 5 })]);
    expect(substituteTokens(plain, { lot: "A" })).toBe(plain);
  });
});
