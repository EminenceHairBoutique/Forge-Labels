import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * The upgrade batch (W-series): logo-derived palettes and arched brand
 * rows, exercised through the real wizard + easy editor UI.
 */

async function startWizard(
  page: Page,
  options: { vial: RegExp; material: RegExp; product?: string },
): Promise<void> {
  await page.goto("/create");
  await page.getByRole("button", { name: options.vial }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /general product/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: options.material }).first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  if (options.product) {
    await page.getByLabel(/product name/i).fill(options.product);
  }
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page.getByText(/what needs to fit\?/i)).toBeVisible();
  await page.getByRole("button", { name: /show my designs/i }).click();
  await page
    .locator('img[alt*="design preview"]')
    .first()
    .waitFor({ timeout: 30_000 });
  await page.locator('button:has(img[alt*="design preview"])').first().click();
  await page.getByRole("button", { name: /use this design/i }).click();
  await page.waitForURL(/\/easy\/[\w-]+/, { timeout: 30_000 });
}

test.describe("upgrade batch", () => {
  test("an uploaded logo offers a contrast-safe from-your-logo palette", async ({
    page,
  }) => {
    await startWizard(page, {
      vial: /^10 mL vial/,
      material: /plain/i,
      product: "Clarity",
    });

    // A solid indigo square stands in for a brand mark.
    const buffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 46, g: 68, b: 204, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    await page.setInputFiles("#easy-logo", {
      name: "logo.png",
      mimeType: "image/png",
      buffer,
    });

    const chip = page.getByRole("button", { name: /colors from your logo/i });
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    // Picking any curated palette hands control back to the library.
    await page
      .getByRole("button", { name: /^use the .* colors$/i })
      .first()
      .click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  test("precut sheet presets warn about fit and export a sheet PDF", async ({
    page,
  }) => {
    await startWizard(page, {
      vial: /^10 mL vial/,
      material: /plain/i,
      product: "Sheet Fit",
    });
    await page.getByRole("button", { name: /download \/ print/i }).click();
    await page.getByRole("button", { name: /print at home/i }).click();
    await page.getByRole("button", { name: /precut label sheets/i }).click();

    // The 10 mL wrap (~74 mm wide) overflows the default 30-up sticker —
    // the mismatch is said plainly, and nothing is silently scaled.
    const preset = page.locator("#sheet-preset");
    await expect(preset).toBeVisible();
    await expect(page.getByText(/cut off at the sticker edge/i)).toBeVisible();

    // The 10-up shipping sticker fits it (with an honest border note).
    await preset.selectOption("letter-10");
    await expect(page.getByText(/cut off at the sticker edge/i)).toHaveCount(0);
    await expect(page.getByText(/blank border/i)).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /make my print sheet/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/print-sheet\.pdf$/);
    const stream = await file.createReadStream();
    const first = await new Promise<Buffer>((resolve) => {
      stream.once("data", (chunk) => resolve(chunk as Buffer));
    });
    expect(first.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("hex elixir arches the brand line as real curved text", async ({ page }) => {
    await startWizard(page, {
      vial: /^10 mL vial/,
      material: /plain/i,
      product: "Clarity",
    });

    // Switch to the arched-brand template via the searchable browser.
    await page.getByRole("button", { name: /browse all templates/i }).click();
    await page.getByLabel(/search templates/i).fill("Hex Elixir");
    await page.getByRole("button", { name: /Hex Elixir — Hex Badge/i }).first().click();
    await page.getByRole("button", { name: /use this template/i }).click();

    await page.getByLabel(/^brand/i).fill("ZEN HEALTH PHARMACEUTICALS");
    // Debounced engine pass → rebuilt objects.
    await page.waitForTimeout(900);

    // The same document opens in the Advanced Editor, where the brand row
    // must be a Konva.TextPath (the shared curved-text render).
    await page.getByRole("link", { name: "Advanced Editor", exact: true }).click();
    await page.waitForURL(/\/editor\/[\w-]+/, { timeout: 30_000 });
    await page.locator(".konvajs-content canvas").first().waitFor({ timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const konva = (window as unknown as { Konva?: { stages: unknown[] } }).Konva;
        if (!konva) return false;
        return (konva.stages as { find: (sel: string) => unknown[] }[]).some(
          (stage) => stage.find("TextPath").length > 0,
        );
      },
      undefined,
      { timeout: 15_000 },
    );
  });
});
