import { expect, test, type Page } from "@playwright/test";

/**
 * §15/§23 — the beginner experience on real device sizes. A phone user
 * must complete the whole flow with no horizontal scrolling, no hover, no
 * precision dragging; larger viewports must hold the same line.
 */

const IPHONE = { width: 390, height: 844 };
const IPAD = { width: 820, height: 1180 };
const LAPTOP = { width: 1280, height: 800 };
const DESKTOP = { width: 1920, height: 1080 };

async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where} must not scroll horizontally`).toBeLessThanOrEqual(1);
}

test.describe("iPhone-sized beginner flow", () => {
  test.use({ viewport: IPHONE });

  test("creates a 20 mL neon label end-to-end without horizontal scrolling", async ({
    page,
  }) => {
    await page.goto("/create");
    await expectNoHorizontalScroll(page, "vial step");
    await page.getByRole("button", { name: /20 mL vial/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /^neon/i }).first().click();
    await expectNoHorizontalScroll(page, "material step");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /neon and energetic/i }).click();
    await page.getByLabel(/brand name/i).fill("VOLT LABS");
    await page.getByLabel(/product name/i).fill("Surge Serum");
    await expectNoHorizontalScroll(page, "style step");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expectNoHorizontalScroll(page, "needs step");
    await page.getByRole("switch", { name: /i want a qr code/i }).click();
    await page.getByRole("button", { name: /show my designs/i }).click();

    await page
      .locator('img[alt*="design preview"]')
      .first()
      .waitFor({ timeout: 30_000 });
    await expectNoHorizontalScroll(page, "pick step");
    await page.locator('button:has(img[alt*="design preview"])').first().click();
    await page.getByRole("button", { name: /use this design/i }).click();
    await page.waitForURL(/\/easy\/[\w-]+/, { timeout: 30_000 });

    // The editor fits the phone: form usable, preview present, no overflow.
    await expect(page.getByLabel(/product name/i)).toHaveValue("Surge Serum");
    await expectNoHorizontalScroll(page, "easy editor");

    // Export a PNG — the full loop without ever needing a computer.
    await page.getByRole("button", { name: /download \/ print/i }).click();
    await page.getByRole("button", { name: /download the design only/i }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /download png/i }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
  });

  test('"Make my label for me" asks once and returns three finished options', async ({
    page,
  }) => {
    await page.goto("/create?auto=1");
    await expect(page.getByText(/make my label for me/i).first()).toBeVisible();
    await page.getByRole("button", { name: /10 mL/i }).first().click();
    await page.getByLabel(/brand name/i).fill("AURELIS LABS");
    await page.getByLabel(/product name/i).fill("Auto Serum");
    await page.getByLabel(/strength or amount/i).fill("10 mg");
    await page.getByRole("button", { name: /holographic/i }).click();
    await expectNoHorizontalScroll(page, "auto step");
    await page.getByRole("button", { name: /^make my label$/i }).click();

    await expect(page.getByText(/your label, three ways/i)).toBeVisible();
    await expect(page.locator('img[alt*="design preview"]')).toHaveCount(3, {
      timeout: 30_000,
    });
    await page.locator('button:has(img[alt*="design preview"])').first().click();
    await page.getByRole("button", { name: /use this design/i }).click();
    await page.waitForURL(/\/easy\/[\w-]+/, { timeout: 30_000 });
    await expect(page.getByLabel(/product name/i)).toHaveValue("Auto Serum");
  });

  test("holographic material stays visible in the label preview", async ({ page }) => {
    await page.goto("/create");
    await page.getByRole("button", { name: /10 mL vial/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /holographic/i }).first().click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /show my designs/i }).click();
    await page
      .locator('img[alt*="design preview"]')
      .first()
      .waitFor({ timeout: 30_000 });
    await page.locator('button:has(img[alt*="design preview"])').first().click();
    await page.getByRole("button", { name: /use this design/i }).click();
    await page.waitForURL(/\/easy\/[\w-]+/, { timeout: 30_000 });

    // The flat preview runs the REAL render pipeline — if the finish tiles
    // render, the holographic material is genuinely in the artwork.
    await page.getByRole("button", { name: /^flat$/i }).click();
    const img = page.getByAltText("Flat label preview");
    await expect(img).toBeVisible({ timeout: 15_000 });
    const isColorful = await img.evaluate((el) => {
      const image = el as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0, 64, 32);
      const data = ctx.getImageData(0, 0, 64, 32).data;
      let saturated = 0;
      for (let i = 0; i < data.length; i += 4) {
        const max = Math.max(data[i]!, data[i + 1]!, data[i + 2]!);
        const min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
        if (max - min > 40) saturated += 1;
      }
      return saturated > 40; // rainbow pattern → many saturated pixels
    });
    expect(isColorful).toBe(true);
  });
});

test.describe("viewport matrix", () => {
  for (const [name, viewport] of [
    ["iPhone", IPHONE],
    ["iPad", IPAD],
    ["laptop", LAPTOP],
    ["desktop", DESKTOP],
  ] as const) {
    test(`${name}: dashboard and wizard render without horizontal overflow`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto("/dashboard");
      await expectNoHorizontalScroll(page, `${name} dashboard`);
      await page.goto("/create");
      await page.getByText(/what are you labeling/i).waitFor();
      await expectNoHorizontalScroll(page, `${name} wizard`);
      await context.close();
    });
  }
});
