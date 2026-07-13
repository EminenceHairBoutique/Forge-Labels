import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";

/**
 * Production separations e2e: assign an object to the white-ink layer via
 * the properties panel, export "Separations", and verify the ZIP contains
 * one PNG per layer in production order plus the manifest and README.
 */

async function createProject(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByLabel(/project name/i).fill("Separations Check");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\/[\w-]+/);
  await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();
}

test.describe("separations export", () => {
  test("exports one PNG per assigned print layer", async ({ page }) => {
    await createProject(page);

    // Artwork rectangle stays on the default layer.
    await page.getByRole("button", { name: /add rectangle/i }).click();
    // The star prints on white ink.
    await page.getByRole("button", { name: /add star/i }).click();
    await page.getByLabel(/print layer/i).click();
    await page.getByRole("option", { name: /white ink/i }).click();

    // The layers panel badges the assignment.
    await page.getByRole("tab", { name: /layers/i }).click();
    await expect(page.getByText(/^white ink$/i)).toBeVisible();

    // Export separations.
    await page.getByRole("button", { name: /^export$/i }).click();
    await page.getByLabel(/format/i).click();
    await page.getByRole("option", { name: /separations/i }).click();
    await expect(page.getByText(/2 layers in use/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/separations\.zip$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const entries = unzipSync(new Uint8Array(Buffer.concat(chunks)));

    const names = Object.keys(entries).sort();
    expect(names.some((n) => n.endsWith("-1-artwork.png"))).toBe(true);
    expect(names.some((n) => n.endsWith("-2-white-ink.png"))).toBe(true);
    expect(names).toContain("manifest.csv");
    expect(names).toContain("README.txt");
    expect(names.filter((n) => n.endsWith(".png"))).toHaveLength(2);

    // Both separations share identical print dimensions (trim + bleed @600).
    const pngs = names.filter((n) => n.endsWith(".png"));
    const dims = pngs.map((n) => {
      const bytes = Buffer.from(entries[n]!);
      return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    });
    expect(dims[0]).toEqual(dims[1]);
    // 77.969 × 30 mm at 600 DPI.
    expect(dims[0]![0]).toBe(Math.round((77.96902001294994 / 25.4) * 600));
    expect(dims[0]![1]).toBe(Math.round((30 / 25.4) * 600));
  });
});
