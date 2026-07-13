import { expect, test, type Page } from "@playwright/test";

/**
 * TIFF export e2e: the client renders the DPI-exact PNG and the server
 * route transcodes it. Verifies the real dialog flow end-to-end plus the
 * route's validation behavior.
 */

async function createProject(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByLabel(/project name/i).fill("TIFF Check");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\/[\w-]+/);
  await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();
}

test.describe("tiff export", () => {
  test("exports a TIFF through the dialog", async ({ page }) => {
    await createProject(page);
    await page.getByRole("button", { name: /add rectangle/i }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /^export$/i }).click();
    await page.getByLabel(/format/i).click();
    await page.getByRole("option", { name: /tiff/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/print-300dpi\.tiff$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);

    // TIFF magic: little-endian "II*\0" or big-endian "MM\0*".
    const magic = bytes.subarray(0, 4);
    const littleEndian = magic[0] === 0x49 && magic[1] === 0x49 && magic[2] === 0x2a;
    const bigEndian = magic[0] === 0x4d && magic[1] === 0x4d && magic[3] === 0x2a;
    expect(littleEndian || bigEndian).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  test("the route rejects non-PNG bodies and bad dpi values", async ({ request }) => {
    const notPng = await request.post("/api/export/tiff?dpi=300", {
      headers: { "Content-Type": "image/png" },
      data: Buffer.from("definitely not a png"),
    });
    expect(notPng.status()).toBe(400);

    const badDpi = await request.post("/api/export/tiff?dpi=99999", {
      headers: { "Content-Type": "image/png" },
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    expect(badDpi.status()).toBe(400);
  });
});
