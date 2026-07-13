import { zipSync, strToU8 } from "fflate";
import type { LabelDocument, PrintLayer } from "@/lib/document/schema";
import {
  PRINT_LAYER_INFO,
  collectUsedLayers,
  filterDocumentToLayer,
} from "@/lib/print/layers";
import { exportRaster } from "./raster";

/**
 * Production separations: one 600 DPI PNG per print layer in use. The
 * artwork layer includes the document background; every spot layer renders
 * its objects at full color on transparency — the printer maps each file to
 * the corresponding spot process (white ink, foil die, varnish screen…).
 */

export interface SeparationsResult {
  blob: Blob;
  /** Layers actually exported, in production order. */
  layers: PrintLayer[];
}

export async function exportSeparations(
  doc: LabelDocument,
  options: { baseName: string; dpi?: 300 | 600 },
): Promise<SeparationsResult> {
  const dpi = options.dpi ?? 600;
  const layers = collectUsedLayers(doc);
  const files: Record<string, Uint8Array> = {};

  const manifest: string[] = ["file,layer,description"];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]!;
    const layerDoc = filterDocumentToLayer(doc, layer);
    const raster = await exportRaster(layerDoc, {
      dpi,
      mode: "print",
      format: "png",
    });
    const fileName = `${options.baseName}-${i + 1}-${layer}.png`;
    files[fileName] = new Uint8Array(await raster.blob.arrayBuffer());
    manifest.push(`${fileName},${layer},"${PRINT_LAYER_INFO[layer].hint}"`);
  }

  files["manifest.csv"] = strToU8(`${manifest.join("\n")}\n`);
  files["README.txt"] = strToU8(
    `Forge Labels — production separations\n\n` +
      `Finished label: ${doc.label.widthMm.toFixed(2)} × ${doc.label.heightMm.toFixed(2)} mm ` +
      `(bleed ${doc.label.bleedMm} mm, ${dpi} DPI, artwork area includes bleed)\n\n` +
      `Each PNG is one print layer:\n` +
      layers
        .map(
          (layer, i) =>
            `- ${i + 1}-${layer}: ${PRINT_LAYER_INFO[layer].label} — ${PRINT_LAYER_INFO[layer].hint}`,
        )
        .join("\n") +
      `\n\nThe artwork file includes the label background; spot layers show\n` +
      `their objects on transparency, at authored colors, for your printer\n` +
      `to map onto the spot process (white ink, foil, varnish…). Confirm\n` +
      `layer handling with your print shop before a production run.\n`,
  );

  const zipped = zipSync(files);
  return {
    blob: new Blob([zipped as unknown as BlobPart], { type: "application/zip" }),
    layers,
  };
}
