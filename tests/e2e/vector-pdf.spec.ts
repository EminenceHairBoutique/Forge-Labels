import { expect, test, type Download, type Page } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName } from "@cantoo/pdf-lib";

/**
 * Vector PDF e2e: exports through the real dialog and proves the honest core
 * claim — solid-fill artwork produces a PDF with ZERO embedded images (true
 * vector paths), while gradient objects fall back to exactly one raster tile.
 * Print boxes must match the raster PDF's mm-exact values.
 */

const MM_TO_PT = 72 / 25.4;

async function createProject(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByLabel(/project name/i).fill("Vector PDF Check");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\/[\w-]+/);
  await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();
}

async function downloadVectorPdf(page: Page): Promise<Buffer> {
  await page.getByRole("button", { name: /^export$/i }).click();
  await page.getByLabel(/format/i).click();
  await page.getByRole("option", { name: /pdf — vector art/i }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
  const download: Download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/vector\.pdf$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function countPageXObjects(bytes: Buffer): Promise<number> {
  const pdf = await PDFDocument.load(new Uint8Array(bytes));
  const resources = pdf.getPage(0).node.Resources();
  const xobjects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  return xobjects ? xobjects.keys().length : 0;
}

test.describe("vector PDF export", () => {
  test("all-solid artwork exports with zero embedded images", async ({ page }) => {
    await createProject(page);
    await page.getByRole("button", { name: /add rectangle/i }).click();
    await page.getByRole("button", { name: /add star/i }).click();
    await page.getByRole("button", { name: /add text/i }).click();
    await expect(page.getByLabel(/text content/i)).toBeVisible();
    await page.keyboard.press("Escape");

    const bytes = await downloadVectorPdf(page);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    expect(await countPageXObjects(bytes)).toBe(0);

    // TrimBox = finished label (73.969 × 26 mm) in points.
    const pdf = await PDFDocument.load(new Uint8Array(bytes));
    const trim = pdf.getPage(0).getTrimBox();
    expect(trim.width).toBeCloseTo(73.96902001294994 * MM_TO_PT, 3);
    expect(trim.height).toBeCloseTo(26 * MM_TO_PT, 3);
  });

  test("a finish-filled object becomes exactly one raster tile", async ({ page }) => {
    await createProject(page);
    // Star + switch its fill to a simulated finish (not vectorizable).
    await page.getByRole("button", { name: /add star/i }).click();
    await page.getByLabel(/^fill$/i).click();
    await page.getByRole("option", { name: /finish/i }).click();

    // The dialog should announce the fallback before export.
    await page.getByRole("button", { name: /^export$/i }).click();
    await page.getByLabel(/format/i).click();
    await page.getByRole("option", { name: /pdf — vector art/i }).click();
    await expect(
      page.getByText(/embedded as 600 DPI raster tiles/i),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);

    expect(await countPageXObjects(bytes)).toBe(1);
  });
});
