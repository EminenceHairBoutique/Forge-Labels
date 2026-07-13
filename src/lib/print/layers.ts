import type {
  LabelDocument,
  LabelObject,
  PrintLayer,
} from "@/lib/document/schema";
import { PrintLayerSchema } from "@/lib/document/schema";

/**
 * Print-production layer semantics. Every object stores a `printLayer`
 * (default "artwork"); a group's non-artwork layer applies to all of its
 * descendants unless a descendant overrides with its own non-artwork value.
 * Separations exports and preflight both resolve layers through here so the
 * inheritance rule has exactly one implementation.
 */

export const PRINT_LAYERS = PrintLayerSchema.options;

export const PRINT_LAYER_INFO: Record<PrintLayer, { label: string; hint: string }> = {
  artwork: { label: "Artwork", hint: "Standard CMYK artwork (default)." },
  "white-ink": {
    label: "White ink",
    hint: "White underprint for clear or metallic stock.",
  },
  "foil-gold": { label: "Gold foil", hint: "Physical gold foil stamp area." },
  "foil-silver": { label: "Silver foil", hint: "Physical silver foil stamp area." },
  "foil-holographic": {
    label: "Holographic foil",
    hint: "Physical holographic foil stamp area.",
  },
  "spot-uv": { label: "Spot UV", hint: "Gloss varnish accent area." },
  emboss: { label: "Emboss", hint: "Raised die area." },
  deboss: { label: "Deboss", hint: "Recessed die area." },
  "die-cut": { label: "Die cut", hint: "Custom cut line (vector outlines only)." },
  varnish: { label: "Varnish", hint: "Overall or flood varnish area." },
};

/** Layer a child effectively prints on, given its nearest assigned ancestor. */
export function effectiveLayer(
  objLayer: PrintLayer,
  inherited: PrintLayer,
): PrintLayer {
  return objLayer !== "artwork" ? objLayer : inherited;
}

/** All layers used by visible objects, in enum (production) order. */
export function collectUsedLayers(doc: LabelDocument): PrintLayer[] {
  const used = new Set<PrintLayer>();
  const walk = (objects: readonly LabelObject[], inherited: PrintLayer) => {
    for (const obj of objects) {
      if (!obj.visible) continue;
      const layer = effectiveLayer(obj.printLayer, inherited);
      if (obj.type === "group") {
        walk(obj.children, layer);
      } else {
        used.add(layer);
      }
    }
  };
  walk(doc.objects, "artwork");
  return PRINT_LAYERS.filter((layer) => used.has(layer));
}

/**
 * A document containing only the objects that print on `layer` (visible
 * leaves; group shells are kept when any descendant survives so transforms
 * stay intact). Spot layers drop the document background — separations
 * render them on transparency; the artwork layer keeps it.
 */
export function filterDocumentToLayer(
  doc: LabelDocument,
  layer: PrintLayer,
): LabelDocument {
  const filterObjects = (
    objects: readonly LabelObject[],
    inherited: PrintLayer,
  ): LabelObject[] => {
    const kept: LabelObject[] = [];
    for (const obj of objects) {
      if (!obj.visible) continue;
      const objLayer = effectiveLayer(obj.printLayer, inherited);
      if (obj.type === "group") {
        const children = filterObjects(obj.children, objLayer);
        if (children.length > 0) kept.push({ ...obj, children });
        continue;
      }
      if (objLayer === layer) kept.push(obj);
    }
    return kept;
  };

  return {
    ...doc,
    background: layer === "artwork" ? doc.background : { type: "none" },
    objects: filterObjects(doc.objects, "artwork"),
  };
}
