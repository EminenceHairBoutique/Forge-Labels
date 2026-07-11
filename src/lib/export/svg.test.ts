import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDocument } from "@/lib/document/defaults";
import type {
  Background,
  GroupObject,
  ImageObject,
  LabelDocument,
  LabelObject,
} from "@/lib/document/schema";
import { fontFileUrl } from "@/lib/fonts/registry";
import { createQrMatrix } from "@/lib/codes/qr";
import {
  barcode,
  ellipse,
  line,
  polygon,
  qr,
  rect,
  star,
  text,
} from "@/lib/templates/authoring";
import { getTemplate } from "@/lib/templates/registry";
import { exportSvg } from "./svg";

/** Node test loader: read font bytes straight from public/fonts via fs. */
async function loadFontBytes(familyId: string, weight: number): Promise<ArrayBuffer> {
  const rel = fontFileUrl(familyId, weight); // e.g. "/fonts/inter-400.ttf"
  const buf = await fs.promises.readFile(path.join(process.cwd(), "public", rel));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function tinyPngBytes(): ArrayBuffer {
  const buf = Buffer.from(TINY_PNG_BASE64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const loadImageBytes = async () => ({ bytes: tinyPngBytes(), mimeType: "image/png" });

/** 10ml-serum default canvas: 73.969 × 26 mm, bleed 2 mm. */
function makeDoc(objects: LabelObject[], background?: Background): LabelDocument {
  const doc = createDocument();
  return { ...doc, ...(background ? { background } : {}), objects };
}

async function run(objects: LabelObject[], background?: Background) {
  return exportSvg(makeDoc(objects, background), { loadFontBytes, loadImageBytes });
}

describe("root geometry", () => {
  it("emits exact mm dimensions spanning trim + bleed", async () => {
    const { svg, warnings } = await run([]);
    expect(svg).toContain('width="77.969mm"');
    expect(svg).toContain('height="30mm"');
    expect(svg).toContain('viewBox="-2 -2 77.969 30"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(warnings).toEqual([]);
  });

  it("spans the trim box only when includeBleed is false", async () => {
    const { svg } = await exportSvg(makeDoc([]), { loadFontBytes, includeBleed: false });
    expect(svg).toContain('width="73.969mm"');
    expect(svg).toContain('viewBox="0 0 73.969 26"');
  });
});

describe("background", () => {
  it("renders a solid background rect covering the bleed", async () => {
    const { svg } = await run([]);
    expect(svg).toContain('<rect x="-2" y="-2" width="77.969" height="30" fill="#ffffff"/>');
  });

  it("renders a linear-gradient background with fills.ts geometry (0° = up)", async () => {
    const { svg } = await run([], {
      type: "linear-gradient",
      angleDeg: 0,
      stops: [
        { offset: 0, color: "#000000" },
        { offset: 1, color: "#ff0000" },
      ],
    });
    expect(svg).toContain('<linearGradient id="grad-background" gradientUnits="userSpaceOnUse"');
    // 0° points up: start at the bottom edge (y = 28), end at the top (y = -2).
    expect(svg).toContain('y1="28"');
    expect(svg).toContain('y2="-2"');
    expect(svg).toContain('<stop offset="0" stop-color="#000000"/>');
    expect(svg).toContain('<stop offset="1" stop-color="#ff0000"/>');
    expect(svg).toContain('fill="url(#grad-background)"');
  });

  it("substitutes finish backgrounds with gray and warns", async () => {
    const { svg, warnings } = await run([], {
      type: "finish",
      finishId: "holographic",
      intensity: 0.8,
      scale: 1,
      angleDeg: 0,
    });
    expect(svg).toContain('fill="#c8c8cc"');
    expect(warnings).toContain(
      "Simulated finish backgrounds are not vector; choose PDF for finish previews.",
    );
  });
});

describe("shapes", () => {
  it("renders solid rects with corner radius and opacity", async () => {
    const { svg } = await run([
      rect({
        id: "r1",
        xMm: 10,
        yMm: 10,
        widthMm: 20,
        heightMm: 10,
        cornerRadiusMm: 2,
        opacity: 0.5,
        fill: { type: "solid", color: "#123456" },
      }),
    ]);
    expect(svg).toContain('<rect x="0" y="0" width="20" height="10" rx="2" fill="#123456"/>');
    expect(svg).toContain('id="r1"');
    expect(svg).toContain('transform="translate(0 5)"');
    expect(svg).toContain('opacity="0.5"');
  });

  it("emits per-object gradient defs with correct stops", async () => {
    const { svg } = await run([
      rect({
        id: "r2",
        xMm: 10,
        yMm: 10,
        widthMm: 20,
        heightMm: 10,
        fill: {
          type: "linear-gradient",
          angleDeg: 90,
          stops: [
            { offset: 0, color: "#111111" },
            { offset: 1, color: "#222222" },
          ],
        },
      }),
      ellipse({
        id: "e1",
        xMm: 40,
        yMm: 10,
        widthMm: 20,
        heightMm: 10,
        fill: {
          type: "radial-gradient",
          stops: [
            { offset: 0, color: "#333333" },
            { offset: 1, color: "#444444" },
          ],
        },
      }),
    ]);
    expect(svg).toContain('<linearGradient id="grad-r2" gradientUnits="userSpaceOnUse"');
    // 90° points right across the 20mm-wide local box.
    expect(svg).toContain('x1="0" y1="5" x2="20" y2="5"');
    expect(svg).toContain('<stop offset="0" stop-color="#111111"/>');
    expect(svg).toContain('<stop offset="1" stop-color="#222222"/>');
    expect(svg).toContain('fill="url(#grad-r2)"');
    expect(svg).toContain('<radialGradient id="grad-e1" gradientUnits="userSpaceOnUse"');
    expect(svg).toContain('<ellipse cx="0" cy="0" rx="10" ry="5"');
  });

  it("renders lines with pt→mm stroke widths and mm dashes", async () => {
    const { svg } = await run([
      line({ id: "l1", xMm: 20, yMm: 10, widthMm: 20, strokePt: 1, dash: [2, 1], cap: "round" }),
    ]);
    expect(svg).toContain('<line x1="-10" y1="0" x2="10" y2="0"');
    expect(svg).toContain('stroke-width="0.3528"'); // 1pt = 0.35278mm
    expect(svg).toContain('stroke-dasharray="0.7056 0.3528"');
    expect(svg).toContain('stroke-linecap="round"');
  });

  it("computes polygon and star vertices like Konva (start at -90°)", async () => {
    const { svg } = await run([
      polygon({ id: "p1", xMm: 15, yMm: 13, widthMm: 20, heightMm: 20, sides: 6 }),
      star({ id: "s1", xMm: 45, yMm: 13, widthMm: 20, heightMm: 20, points: 5, innerRatio: 0.5 }),
    ]);
    expect(svg).toContain('<polygon points="0,-10 8.66,-5 8.66,5 0,10 -8.66,5 -8.66,-5"');
    expect(svg).toContain('points="0,-10 2.939,-4.045'); // outer then inner vertex
  });

  it("honors rotation with center-pivot transforms", async () => {
    const { svg } = await run([
      rect({ id: "r3", xMm: 20, yMm: 10, widthMm: 20, heightMm: 10, rotationDeg: 30 }),
    ]);
    expect(svg).toContain('transform="translate(20 10) rotate(30) translate(-10 -5)"');
  });
});

describe("text", () => {
  const baseText = {
    text: "Serum",
    xMm: 30,
    yMm: 10,
    widthMm: 40,
    heightMm: 8,
    fontSizePt: 10,
    align: "left" as const,
  };

  it("converts text to vector paths (no <text> elements)", async () => {
    const { svg } = await run([text({ id: "t1", ...baseText })]);
    expect(svg).toContain("<path d=");
    expect(svg).not.toContain("<text");
    const d = svg.match(/<path d="([^"]+)"/)?.[1] ?? "";
    expect(d.length).toBeGreaterThan(100);
    expect(d.startsWith("M")).toBe(true);
  });

  it("shifts line start with alignment", async () => {
    const first = (svg: string) => Number(svg.match(/<path d="M(-?[\d.]+)/)?.[1]);
    const left = await run([text({ id: "t2", ...baseText, align: "left" })]);
    const center = await run([text({ id: "t3", ...baseText, align: "center" })]);
    const right = await run([text({ id: "t4", ...baseText, align: "right" })]);
    const xLeft = first(left.svg);
    const xCenter = first(center.svg);
    const xRight = first(right.svg);
    expect(xLeft).toBeLessThan(xCenter);
    expect(xCenter).toBeLessThan(xRight);
  });

  it("stacks lines with lineHeight and applies textTransform", async () => {
    const { svg } = await run([
      text({
        id: "t5",
        ...baseText,
        text: "one\ntwo",
        textTransform: "uppercase",
        lineHeight: 1.5,
      }),
    ]);
    const paths = svg.match(/<path d="/g) ?? [];
    expect(paths.length).toBe(2);
  });

  it("lays curved text glyphs along the arc with per-glyph rotations", async () => {
    const { svg } = await run([
      text({
        id: "ct1",
        text: "CURVED",
        xMm: 30,
        yMm: 15,
        widthMm: 30,
        heightMm: 12,
        fontSizePt: 8,
        curve: { radiusMm: 10, direction: "up" },
      }),
    ]);
    const glyphTransforms = svg.match(/<path transform="translate\([-\d. ]+\) rotate\([\d.]+\)" d="M/g) ?? [];
    expect(glyphTransforms.length).toBeGreaterThanOrEqual(5);
  });

  it("falls back to Inter 400 with a warning for unknown fonts", async () => {
    const { svg, warnings } = await run([
      text({ id: "t6", ...baseText, fontFamilyId: "comic-sans" }),
    ]);
    expect(svg).toContain("<path d=");
    expect(warnings.some((w) => w.includes('"comic-sans"'))).toBe(true);
  });
});

describe("QR codes", () => {
  it("emits one circle per dark module for dot styling", async () => {
    const value = "https://example.com";
    const matrix = createQrMatrix(value, "M");
    let darks = 0;
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) if (matrix.get(x, y)) darks++;
    }
    const { svg } = await run([
      qr({ id: "q1", value, xMm: 13, yMm: 13, widthMm: 20, moduleShape: "dot" }),
    ]);
    const circles = svg.match(/<circle /g) ?? [];
    expect(circles.length).toBe(darks);
    expect(svg).not.toContain("<image"); // pure vector
  });

  it("merges square modules into path runs with quiet-zone offsets", async () => {
    const { svg } = await run([
      qr({ id: "q2", value: "FORGE", xMm: 13, yMm: 13, widthMm: 20, bgColor: "#ffffff" }),
    ]);
    expect(svg).toMatch(/d="M\d+ \d+h\d+v1h-\d+z/);
    // Finder pattern top row starts at the quiet zone offset (4,4), 7 wide.
    expect(svg).toContain("M4 4h7v1h-7z");
    const total = createQrMatrix("FORGE", "M").size + 8;
    expect(svg).toContain(`<rect x="0" y="0" width="${total}" height="${total}" fill="#ffffff"/>`);
  });

  it("omits logos with a scannability warning", async () => {
    const { warnings } = await run([
      qr({
        id: "q3",
        value: "https://example.com",
        xMm: 13,
        yMm: 13,
        widthMm: 20,
        logo: { source: { kind: "url", url: "/logo.png" }, sizeRatio: 0.2 },
      }),
    ]);
    expect(warnings).toContain(
      "QR logo overlays are omitted in SVG export — verify scannability",
    );
  });
});

describe("barcodes", () => {
  it("embeds bwip-js vector output for valid code128", async () => {
    const { svg, warnings } = await run([
      barcode({ id: "b1", value: "LOT-0001", xMm: 36, yMm: 13, widthMm: 40, heightMm: 12 }),
    ]);
    expect(svg).toContain('id="b1"');
    expect(svg).toMatch(/<g transform="scale\([\d.]+ [\d.]+\)">/);
    expect(svg).toContain('stroke="#000000"'); // bars are stroked paths
    expect(svg).not.toContain("<image");
    expect(warnings).toEqual([]);
  });

  it("skips invalid EAN payloads with a warning", async () => {
    const { svg, warnings } = await run([
      barcode({
        id: "b2",
        value: "12345",
        symbology: "ean13",
        xMm: 36,
        yMm: 13,
        widthMm: 40,
        heightMm: 12,
      }),
    ]);
    expect(svg).not.toContain('id="b2"');
    expect(warnings.some((w) => w.startsWith('Barcode "b2" skipped:'))).toBe(true);
  });
});

describe("images", () => {
  const baseImage: Omit<ImageObject, "id" | "filters"> = {
    name: "",
    type: "image",
    xMm: 20,
    yMm: 13,
    widthMm: 20,
    heightMm: 10,
    rotationDeg: 0,
    opacity: 1,
    locked: false,
    visible: true,
    printLayer: "artwork",
    source: { kind: "url", url: "/x.png" },
    naturalWidthPx: 100,
    naturalHeightPx: 50,
    fit: "cover",
    flipX: false,
    flipY: false,
  };
  const defaultFilters = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blurPx: 0,
    grayscale: false,
  };

  it("embeds original bytes as a data URI at the resolved layout", async () => {
    const { svg, warnings } = await run([
      { ...baseImage, id: "img1", filters: defaultFilters },
    ]);
    expect(svg).toContain('href="data:image/png;base64,');
    expect(svg).toContain('preserveAspectRatio="none"');
    expect(svg).toContain('width="20" height="10"');
    expect(warnings).toEqual([]);
  });

  it("clips cropped images and warns about unapplied filters", async () => {
    const { svg, warnings } = await run([
      {
        ...baseImage,
        id: "img2",
        naturalHeightPx: 100, // square source into a 2:1 box → cover crop
        flipX: true,
        filters: { ...defaultFilters, brightness: 0.5 },
      },
    ]);
    expect(svg).toContain('<clipPath id="clip-img2">');
    expect(svg).toContain('clip-path="url(#clip-img2)"');
    expect(svg).toContain("scale(-1 1)");
    expect(warnings).toContain("image adjustments are not applied in SVG export");
  });
});

describe("groups", () => {
  it("recurses with the group transform (children in top-left space)", async () => {
    const child = rect({
      id: "gc1",
      xMm: 10,
      yMm: 5,
      widthMm: 20,
      heightMm: 10,
      fill: { type: "solid", color: "#ff0000" },
    });
    const group: GroupObject = {
      id: "grp1",
      name: "",
      type: "group",
      xMm: 20,
      yMm: 10,
      widthMm: 20,
      heightMm: 10,
      rotationDeg: 30,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      children: [child],
    };
    const { svg } = await run([group]);
    expect(svg).toContain('id="grp1" transform="translate(20 10) rotate(30) translate(-10 -5)"');
    expect(svg).toContain('fill="#ff0000"');
  });

  it("skips invisible objects entirely", async () => {
    const { svg } = await run([
      rect({ id: "hidden", xMm: 10, yMm: 10, widthMm: 5, heightMm: 5, visible: false }),
    ]);
    expect(svg).not.toContain('id="hidden"');
  });
});

describe("warnings", () => {
  it("reports shadows once", async () => {
    const shadow = { color: "#000000", opacity: 0.5, blurPt: 2, offsetXPt: 1, offsetYPt: 1 };
    const { warnings } = await run([
      rect({ id: "sh1", xMm: 10, yMm: 10, widthMm: 5, heightMm: 5, shadow }),
      rect({ id: "sh2", xMm: 20, yMm: 10, widthMm: 5, heightMm: 5, shadow }),
    ]);
    const shadowWarnings = warnings.filter(
      (w) => w === "drop shadows are rasterized only in PNG/PDF exports; omitted in SVG",
    );
    expect(shadowWarnings.length).toBe(1);
  });
});

describe("template round-trip", () => {
  it("exports noir-dark-luxury as pure vectors", async () => {
    const template = getTemplate("noir-dark-luxury");
    expect(template).toBeDefined();
    const { svg, warnings } = await exportSvg(template!.doc, { loadFontBytes });
    const paths = svg.match(/<path d="/g) ?? [];
    expect(paths.length).toBeGreaterThanOrEqual(3);
    expect(svg).not.toContain("<text");
    // Keyline rect: no fill, gold stroke in mm (0.9pt).
    expect(svg).toContain('fill="none" stroke="#c8a55a" stroke-width="0.3175"');
    expect(warnings).toEqual([]);
  });
});
