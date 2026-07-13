import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";

/**
 * CSV batch e2e: token in the text content → upload a 3-row CSV → auto-map →
 * export → unzip and verify one dimension-exact PNG per row + manifest.
 */

async function createProject(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /new label/i }).click();
  await page.getByLabel(/project name/i).fill("Batch Check");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\/[\w-]+/);
  await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();
}

test.describe("csv batch export", () => {
  test("exports one PNG per row with substituted fields", async ({ page }) => {
    await createProject(page);

    // Text object with a {{lot}} placeholder.
    await page.getByRole("button", { name: /add text/i }).click();
    const content = page.getByLabel(/text content/i);
    await expect(content).toBeVisible();
    await content.fill("Lot {{lot}}");

    // Preflight treats the token as batch data, not an error (spot check the
    // insert-data-field affordance is present too).
    await expect(page.getByRole("button", { name: /insert data field/i })).toBeVisible();

    // Open the batch dialog and upload the fixture.
    await page.getByRole("button", { name: /^batch$/i }).click();
    await expect(page.getByText(/1 data field in this label/i)).toBeVisible();
    await page
      .locator('input[type="file"]#batch-csv')
      .setInputFiles(path.join(process.cwd(), "tests/e2e/fixtures/batch.csv"));

    // Auto-mapped to the "lot" column; 3 rows detected.
    await expect(page.getByText(/3 rows · 2 columns/i)).toBeVisible();
    await expect(page.getByLabel(/column for lot/i)).toContainText("lot");

    // Validate — all clean.
    await page.getByRole("button", { name: /validate all rows/i }).click();
    await expect(page.getByText(/all 3 rows validate cleanly/i)).toBeVisible();

    // Export and unzip.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export 3 labels/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/batch\.zip$/);

    const filePath = await download.path();
    const entries = unzipSync(new Uint8Array(readFileSync(filePath!)));
    const names = Object.keys(entries);

    expect(names.filter((n) => n.endsWith(".png"))).toHaveLength(3);
    expect(names).toContain("manifest.csv");
    expect(names).toContain("README.txt");

    // Manifest maps rows to files with their source values.
    const manifest = strFromU8(entries["manifest.csv"]!);
    expect(manifest).toContain("A42");
    expect(manifest).toContain("C99");

    // Each PNG is the exact die-cut trim size at 300 DPI (874 × 307 px).
    for (const name of names.filter((n) => n.endsWith(".png"))) {
      const bytes = Buffer.from(entries[name]!);
      expect(bytes.readUInt32BE(16)).toBe(Math.round((73.96902001294994 / 25.4) * 300));
      expect(bytes.readUInt32BE(20)).toBe(Math.round((26 / 25.4) * 300));
    }
  });

  test("teaches the token syntax when the label has no fields", async ({ page }) => {
    await createProject(page);
    await page.getByRole("button", { name: /^batch$/i }).click();
    await expect(page.getByText(/no data fields yet/i)).toBeVisible();
  });
});
