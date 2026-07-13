import type {
  Background,
  Fill,
  LabelDocument,
  LabelObject,
} from "@/lib/document/schema";
import { MAX_SUMMARY_CHARS } from "./protocol";

/**
 * Compact, deterministic document summary for the assistant. The raw
 * document never goes over the wire — this text rides along with every
 * user message (and backs the get_document_state tool), so it is capped
 * hard: 0.1 mm rounding, 60 objects, 8 KB.
 */

export const MAX_SUMMARY_OBJECTS = 60;

function mm(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function fillLabel(fill: Fill): string {
  switch (fill.type) {
    case "none":
      return "no fill";
    case "solid":
      return fill.color;
    case "linear-gradient":
      return `linear-gradient(${fill.stops.map((s) => s.color).join("→")})`;
    case "radial-gradient":
      return `radial-gradient(${fill.stops.map((s) => s.color).join("→")})`;
    case "finish":
      return `finish:${fill.finishId}`;
  }
}

function backgroundLabel(background: Background): string {
  switch (background.type) {
    case "none":
      return "none (transparent — substrate shows)";
    case "solid":
      return background.color;
    case "linear-gradient":
      return `linear-gradient(${background.stops.map((s) => s.color).join("→")})`;
    case "finish":
      return `finish:${background.finishId}`;
  }
}

function describeObject(obj: LabelObject): string {
  switch (obj.type) {
    case "text": {
      const text = obj.text.length > 60 ? `${obj.text.slice(0, 57)}…` : obj.text;
      const curve = obj.curve ? ` curved(${obj.curve.direction})` : "";
      return `text ${JSON.stringify(text)} font=${obj.fontFamilyId}:${obj.fontWeight} ${obj.fontSizePt}pt align=${obj.align} fill=${fillLabel(obj.fill)}${curve}`;
    }
    case "rect":
      return `rect fill=${fillLabel(obj.fill)}${obj.cornerRadiusMm ? ` r=${mm(obj.cornerRadiusMm)}` : ""}`;
    case "ellipse":
      return `ellipse fill=${fillLabel(obj.fill)}`;
    case "line":
      return `line ${obj.strokePt}pt ${obj.color}`;
    case "polygon":
      return `polygon sides=${obj.sides} fill=${fillLabel(obj.fill)}`;
    case "star":
      return `star points=${obj.points} fill=${fillLabel(obj.fill)}`;
    case "image":
      return `image fit=${obj.fit}`;
    case "qrcode": {
      const value =
        obj.value.length > 40 ? `${obj.value.slice(0, 37)}…` : obj.value;
      return `qrcode ${JSON.stringify(value)} ec=${obj.ecLevel} fg=${obj.fgColor}`;
    }
    case "barcode": {
      const value =
        obj.value.length > 40 ? `${obj.value.slice(0, 37)}…` : obj.value;
      return `barcode ${obj.symbology} ${JSON.stringify(value)}`;
    }
    case "group":
      return `group (${obj.children.length} children)`;
  }
}

function objectLines(
  objects: readonly LabelObject[],
  selection: ReadonlySet<string>,
  depth: number,
  out: string[],
  counter: { n: number; truncated: number },
): void {
  for (const obj of objects) {
    if (counter.n >= MAX_SUMMARY_OBJECTS) {
      counter.truncated += 1 + (obj.type === "group" ? countTree(obj.children) : 0);
      continue;
    }
    counter.n += 1;
    const indent = "  ".repeat(depth);
    const flags = [
      selection.has(obj.id) ? "SELECTED" : "",
      obj.visible ? "" : "hidden",
      obj.locked ? "locked" : "",
      obj.printLayer !== "artwork" ? `layer=${obj.printLayer}` : "",
      obj.opacity !== 1 ? `opacity=${obj.opacity}` : "",
      obj.rotationDeg ? `rot=${mm(obj.rotationDeg)}°` : "",
    ]
      .filter(Boolean)
      .join(" ");
    out.push(
      `${indent}- id=${obj.id}${obj.name ? ` "${obj.name}"` : ""} ${describeObject(obj)} at (${mm(obj.xMm)}, ${mm(obj.yMm)}) size ${mm(obj.widthMm)}×${mm(obj.heightMm)}mm${flags ? ` [${flags}]` : ""}`,
    );
    if (obj.type === "group") {
      objectLines(obj.children, selection, depth + 1, out, counter);
    }
  }
}

function countTree(objects: readonly LabelObject[]): number {
  let n = 0;
  for (const obj of objects) {
    n += 1;
    if (obj.type === "group") n += countTree(obj.children);
  }
  return n;
}

export function summarizeDocument(
  doc: LabelDocument,
  selection: readonly string[] = [],
): string {
  const lines: string[] = [];
  const label = doc.label;
  lines.push(
    `Label: ${mm(label.widthMm)}×${mm(label.heightMm)}mm ${label.shape} (${label.style}), bleed ${mm(label.bleedMm)}mm, safe ${mm(label.safeMm)}mm, corner radius ${mm(label.cornerRadiusMm)}mm.`,
  );
  lines.push(
    `Vial: ⌀${mm(doc.vial.diameterMm)}mm, wall height ${mm(doc.vial.straightWallHeightMm)}mm.`,
  );
  lines.push(`Background: ${backgroundLabel(doc.background)}. Substrate: ${doc.substrateId}.`);
  lines.push(
    "Coordinates: mm, origin at the label's top-left TRIM corner; x/y is each object's CENTER. Z-order: listed back to front.",
  );

  const total = countTree(doc.objects);
  if (total === 0) {
    lines.push("Objects: none (empty canvas).");
  } else {
    lines.push(`Objects (${total}):`);
    const counter = { n: 0, truncated: 0 };
    objectLines(doc.objects, new Set(selection), 0, lines, counter);
    if (counter.truncated > 0) {
      lines.push(`…and ${counter.truncated} more objects (summary capped).`);
    }
  }

  let text = lines.join("\n");
  if (text.length > MAX_SUMMARY_CHARS) {
    text = `${text.slice(0, MAX_SUMMARY_CHARS - 15)}\n…(truncated)`;
  }
  return text;
}
