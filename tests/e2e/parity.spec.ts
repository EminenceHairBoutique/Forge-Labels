import { expect, test, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";

/**
 * WYSIWYG regression: the live editor canvas and the exported PNG must render
 * the same pixels. Both pipelines share src/lib/render/node-configs.ts; this
 * test catches any drift between them by capturing the editor's Konva stage
 * at export resolution and pixelmatching it against a real PNG export.
 *
 * The comparison region is inset from the trim edge so rounded corners, the
 * paper drop shadow, and the die-cut alpha edge (all intentionally different
 * between screen preview and sticker export) stay out of frame.
 */

const TRIM_W_MM = 73.96902001294994; // 10 mL serum default wrap width
const TRIM_H_MM = 26;
const DPI = 300;
const PX_PER_MM = DPI / 25.4;
// 24 px = 2.032 mm: integer export pixels, clear of the 1.5 mm corner radius.
const INSET_PX = 24;
const CROP_W = Math.floor(TRIM_W_MM * PX_PER_MM) - 2 * INSET_PX;
const CROP_H = Math.floor(TRIM_H_MM * PX_PER_MM) - 2 * INSET_PX;

async function createProject(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByLabel(/project name/i).fill("Parity Check");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\/[\w-]+/);
  await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();
}

/** Raw RGBA of a crop of the live stage, rendered at export resolution. */
async function captureEditorPixels(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ({ insetPx, cropW, cropH, pxPerMm }) => {
      await document.fonts.ready;
      const konva = (
        window as unknown as {
          Konva?: { stages: Array<Record<string, () => unknown>> };
        }
      ).Konva;
      if (!konva || konva.stages.length === 0) {
        throw new Error("Konva global stage registry not found");
      }
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const stage = konva.stages[0] as any;
      const layers = stage.getLayers();
      if (layers.length !== 3) {
        throw new Error(`expected 3 editor layers, found ${layers.length}`);
      }
      // Pan/zoom live on the scaled content group, not the stage.
      const content = layers[1].getChildren()[0];
      const zoom: number = content.scaleX();
      const panX: number = content.x();
      const panY: number = content.y();
      const insetMm = insetPx / pxPerMm;

      // Overlay layer holds guides/transformer/marquee — not part of the art.
      layers[2].hide();
      let canvas: HTMLCanvasElement;
      try {
        canvas = stage.toCanvas({
          x: panX + insetMm * zoom,
          y: panY + insetMm * zoom,
          width: (cropW / pxPerMm) * zoom + 2,
          height: (cropH / pxPerMm) * zoom + 2,
          pixelRatio: pxPerMm / zoom,
        });
      } finally {
        layers[2].show();
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const data = canvas
        .getContext("2d")!
        .getImageData(0, 0, cropW, cropH).data;
      let s = "";
      for (let i = 0; i < data.length; i += 32768) {
        s += String.fromCharCode(
          ...Array.from(data.subarray(i, Math.min(i + 32768, data.length))),
        );
      }
      return btoa(s);
    },
    { insetPx: INSET_PX, cropW: CROP_W, cropH: CROP_H, pxPerMm: PX_PER_MM },
  );
  return Buffer.from(b64, "base64");
}

/** Decode the exported PNG in the page and crop the same region. */
async function cropExportPixels(page: Page, png: Buffer): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ({ pngB64, insetPx, cropW, cropH }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${pngB64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = cropW;
      c.height = cropH;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, insetPx, insetPx, cropW, cropH, 0, 0, cropW, cropH);
      const data = ctx.getImageData(0, 0, cropW, cropH).data;
      let s = "";
      for (let i = 0; i < data.length; i += 32768) {
        s += String.fromCharCode(
          ...Array.from(data.subarray(i, Math.min(i + 32768, data.length))),
        );
      }
      return btoa(s);
    },
    { pngB64: png.toString("base64"), insetPx: INSET_PX, cropW: CROP_W, cropH: CROP_H },
  );
  return Buffer.from(b64, "base64");
}

test.describe("editor ↔ export parity", () => {
  test("the exported PNG matches the editor canvas pixel-for-pixel", async ({
    page,
  }) => {
    await createProject(page);

    // Full-coverage rectangle so the crop region is entirely authored art,
    // then a star (gold — contrasts the purple rect) and text on top: solid
    // fills, polygon geometry, and real font rasterization all exercise the
    // shared node-config path.
    await page.getByRole("button", { name: /add rectangle/i }).click();
    await page.locator("#obj-w").fill("80");
    await page.locator("#obj-w").press("Enter");
    await page.locator("#obj-h").fill("30");
    await page.locator("#obj-h").press("Enter");
    await page.getByRole("button", { name: /add star/i }).click();
    await page.getByRole("button", { name: /add text/i }).click();
    await expect(page.getByLabel(/text content/i)).toBeVisible();

    // Deselect so the transformer disappears from the overlay layer.
    await page.keyboard.press("Escape");

    const editorPixels = await captureEditorPixels(page);

    // Real user-facing export: PNG die-cut sticker at 300 DPI.
    await page.getByRole("button", { name: /^export$/i }).click();
    await page.getByLabel(/format/i).click();
    await page.getByRole("option", { name: /die-cut sticker/i }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const exportPixels = await cropExportPixels(page, Buffer.concat(chunks));

    expect(editorPixels.length).toBe(CROP_W * CROP_H * 4);
    expect(exportPixels.length).toBe(CROP_W * CROP_H * 4);

    // Sanity: the capture actually contains the layered artwork — purple
    // rectangle (#4c3d8f) with the gold star (#d4af5f) on top — rather than
    // a blank or misplaced region.
    const near = (i: number, r: number, g: number, b: number) =>
      Math.abs(editorPixels[i]! - r) < 12 &&
      Math.abs(editorPixels[i + 1]! - g) < 12 &&
      Math.abs(editorPixels[i + 2]! - b) < 12;
    let rectFillPx = 0;
    let starFillPx = 0;
    for (let i = 0; i < editorPixels.length; i += 4) {
      if (near(i, 0x4c, 0x3d, 0x8f)) rectFillPx += 1;
      else if (near(i, 0xd4, 0xaf, 0x5f)) starFillPx += 1;
    }
    const total = CROP_W * CROP_H;
    expect(rectFillPx / total).toBeGreaterThan(0.2);
    expect(starFillPx / total).toBeGreaterThan(0.003);

    const diff = pixelmatch(
      new Uint8Array(editorPixels),
      new Uint8Array(exportPixels),
      undefined,
      CROP_W,
      CROP_H,
      { threshold: 0.12 },
    );
    const diffRatio = diff / (CROP_W * CROP_H);
    expect(diffRatio).toBeLessThan(0.005);
  });
});
