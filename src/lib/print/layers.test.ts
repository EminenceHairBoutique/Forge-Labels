import { describe, expect, it } from "vitest";
import type { GroupObject, LabelDocument, LabelObject } from "@/lib/document/schema";
import { createDocument } from "@/lib/document/defaults";
import { rect, star, text } from "@/lib/templates/authoring";
import {
  collectUsedLayers,
  effectiveLayer,
  filterDocumentToLayer,
} from "./layers";

function makeDoc(objects: LabelObject[]): LabelDocument {
  return { ...createDocument(), objects };
}

function group(children: LabelObject[], overrides: Partial<GroupObject> = {}): GroupObject {
  return {
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
    children,
    ...overrides,
  };
}

describe("effectiveLayer", () => {
  it("inherits the ancestor's layer only while the object stays on artwork", () => {
    expect(effectiveLayer("artwork", "white-ink")).toBe("white-ink");
    expect(effectiveLayer("spot-uv", "white-ink")).toBe("spot-uv");
    expect(effectiveLayer("artwork", "artwork")).toBe("artwork");
  });
});

describe("collectUsedLayers", () => {
  it("orders layers by production order and dedupes", () => {
    const doc = makeDoc([
      star({ id: "s", xMm: 10, yMm: 10, widthMm: 8, heightMm: 8, printLayer: "spot-uv" }),
      rect({ id: "r", xMm: 30, yMm: 10, widthMm: 8, heightMm: 8 }),
      rect({ id: "w", xMm: 50, yMm: 10, widthMm: 8, heightMm: 8, printLayer: "white-ink" }),
    ]);
    expect(collectUsedLayers(doc)).toEqual(["artwork", "white-ink", "spot-uv"]);
  });

  it("resolves group inheritance and skips hidden objects", () => {
    const doc = makeDoc([
      group(
        [
          rect({ id: "c1", xMm: 5, yMm: 5, widthMm: 4, heightMm: 4 }),
          rect({ id: "c2", xMm: 15, yMm: 5, widthMm: 4, heightMm: 4, printLayer: "varnish" }),
        ],
        { printLayer: "foil-gold" },
      ),
      rect({ id: "h", xMm: 60, yMm: 10, widthMm: 4, heightMm: 4, visible: false, printLayer: "emboss" }),
    ]);
    expect(collectUsedLayers(doc)).toEqual(["foil-gold", "varnish"]);
  });
});

describe("filterDocumentToLayer", () => {
  const doc = makeDoc([
    rect({ id: "bg", xMm: 20, yMm: 13, widthMm: 30, heightMm: 20 }),
    group(
      [
        text({ id: "t", text: "FOIL", xMm: 5, yMm: 5, widthMm: 10, fontSizePt: 8 }),
        rect({ id: "art", xMm: 15, yMm: 5, widthMm: 4, heightMm: 4, printLayer: "artwork" }),
      ],
      { printLayer: "foil-gold" },
    ),
    star({ id: "uv", xMm: 60, yMm: 13, widthMm: 8, heightMm: 8, printLayer: "spot-uv" }),
  ]);

  it("keeps only matching leaves, preserving group shells", () => {
    const foil = filterDocumentToLayer(doc, "foil-gold");
    expect(foil.objects).toHaveLength(1);
    const g = foil.objects[0] as GroupObject;
    expect(g.type).toBe("group");
    // Both children inherit foil-gold (the rect's explicit "artwork" default
    // does not override — only non-artwork assignments do).
    expect(g.children.map((c) => c.id)).toEqual(["t", "art"]);
  });

  it("strips the background for spot layers but keeps it for artwork", () => {
    const uv = filterDocumentToLayer(doc, "spot-uv");
    expect(uv.background).toEqual({ type: "none" });
    expect(uv.objects.map((o) => o.id)).toEqual(["uv"]);

    const art = filterDocumentToLayer(doc, "artwork");
    expect(art.background).toEqual(doc.background);
    expect(art.objects.map((o) => o.id)).toEqual(["bg"]);
  });

  it("drops group shells with no surviving children", () => {
    const emboss = filterDocumentToLayer(doc, "emboss");
    expect(emboss.objects).toHaveLength(0);
  });
});
