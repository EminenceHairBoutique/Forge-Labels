import { expect, test, type Download, type Page } from "@playwright/test";

/**
 * Editor flow e2e: create a project (local demo mode), edit on the canvas,
 * verify autosave persistence, and check DPI-exact export dimensions —
 * the core dimensional-accuracy guarantee, verified in a real browser.
 */

async function createProject(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByLabel(/project name/i).fill("E2E Serum Label");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\/[\w-]+/);
  await expect(page.getByTestId("editor-canvas")).toBeVisible();
  // Konva stage mounts a canvas element.
  await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();
}

test.describe("editor", () => {
  test("creates a project and shows the dimension-accurate canvas", async ({ page }) => {
    await createProject(page);
    // Default 10 mL serum: 73.969 → 74.0 shown in the width field (mm).
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("74.0");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("26.0");
  });

  test("adds text and shapes, undoes, and autosaves", async ({ page }) => {
    await createProject(page);

    // Adding an object selects it — the properties panel switches to it.
    await page.getByRole("button", { name: /add text/i }).click();
    await expect(page.getByLabel(/text content/i)).toBeVisible();

    await page.getByRole("button", { name: /add rectangle/i }).click();
    await expect(page.getByLabel(/^fill$/i)).toBeVisible();

    // Layers tab lists both objects.
    await page.getByRole("tab", { name: /layers/i }).click();
    await expect(page.getByRole("button", { name: /select rectangle/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^select text$/i })).toBeVisible();

    // Undo removes the rectangle.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByRole("button", { name: /select rectangle/i })).toHaveCount(0);

    // Redo restores it.
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(page.getByRole("button", { name: /select rectangle/i })).toBeVisible();

    // Autosave persists across reload (IndexedDB).
    await expect(page.getByText(/saved in this browser/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.reload();
    await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();
    await page.getByRole("tab", { name: /layers/i }).click();
    await expect(page.getByRole("button", { name: /select rectangle/i })).toBeVisible();
  });

  test("exports a PNG with exact pixel dimensions for the physical size", async ({
    page,
  }) => {
    await createProject(page);

    await page.getByRole("button", { name: /^export$/i }).click();
    await page.getByLabel(/format/i).click();
    await page.getByRole("option", { name: /die-cut sticker/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
    const download: Download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);

    // Verify pixel dimensions: 73.969 mm × 26 mm at 300 DPI → 874 × 307 px.
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);

    // PNG IHDR: width at offset 16, height at offset 20 (big-endian).
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    expect(width).toBe(Math.round((73.96902001294994 / 25.4) * 300)); // 874
    expect(height).toBe(Math.round((26 / 25.4) * 300)); // 307

    // pHYs chunk must carry 300 DPI (11811 pixels per meter).
    const physIndex = bytes.indexOf(Buffer.from("pHYs"));
    expect(physIndex).toBeGreaterThan(0);
    const ppmX = bytes.readUInt32BE(physIndex + 4);
    expect(ppmX).toBe(Math.round(300 / 0.0254));
  });

  test("creates a project from a template with rescaled objects", async ({ page }) => {
    await page.goto("/templates");
    await expect(
      page.getByRole("heading", { name: /template library/i }),
    ).toBeVisible();

    // Filter by category, then use a template.
    await page.getByRole("button", { name: /^luxury$/i }).click();
    await page
      .getByRole("link", { name: /use this template/i })
      .first()
      .click();
    await page.waitForURL(/\/editor\/[\w-]+/);
    await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();

    // Template objects arrived: the layers panel is populated.
    await page.getByRole("tab", { name: /layers/i }).click();
    const rows = page.getByRole("list", { name: /layers/i }).getByRole("listitem");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(4);
  });

  test("adds a QR code and warns when it gets too small", async ({ page }) => {
    await createProject(page);
    await page.getByRole("button", { name: /add qr code/i }).click();
    await expect(page.getByLabel(/website url/i)).toBeVisible();

    // Shrink the QR below scannability and expect the module warning.
    await page.getByLabel("Width", { exact: true }).fill("6");
    await page.getByLabel("Width", { exact: true }).press("Enter");
    await expect(page.getByText(/below the 0\.4 mm scanning guideline/i)).toBeVisible();
  });

  test("exports a true-vector SVG with outlined text", async ({ page }) => {
    await createProject(page);
    await page.getByRole("button", { name: /add text/i }).click();
    await expect(page.getByLabel(/text content/i)).toBeVisible();

    await page.getByRole("button", { name: /^export$/i }).click();
    await page.getByLabel(/format/i).click();
    await page.getByRole("option", { name: /svg — vector/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf8");

    // Physical size + vector text (outlined to paths, no <text> element).
    expect(svg).toContain('width="77.969mm"');
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
  });

  test("exports a print-ready PDF", async ({ page }) => {
    await createProject(page);

    await page.getByRole("button", { name: /^export$/i }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: /^export$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/print\.pdf$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    // TrimBox present (print-ready marker).
    expect(bytes.includes(Buffer.from("/TrimBox"))).toBe(true);
  });
});
