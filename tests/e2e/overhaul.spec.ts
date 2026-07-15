import { expect, test, type Page } from "@playwright/test";

/**
 * §24 of the template/typography overhaul brief — the cases not already
 * covered by easy-creator/easy-mobile/parity: glossy 30 mL with a long
 * auto-fitting name and density-aware recommendations, typography
 * personality switching, and the transparent-material white-ink warning.
 */

async function startWizard(
  page: Page,
  options: { vial: RegExp; material: RegExp; product?: string; density?: RegExp },
): Promise<void> {
  await page.goto("/create");
  await page.getByRole("button", { name: options.vial }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: options.material }).first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  if (options.product) {
    await page.getByLabel(/product name/i).fill(options.product);
  }
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page.getByText(/what needs to fit\?/i)).toBeVisible();
  if (options.density) {
    await page.getByRole("button", { name: options.density }).click();
  }
  await page.getByRole("button", { name: /show my designs/i }).click();
  await page
    .locator('img[alt*="design preview"]')
    .first()
    .waitFor({ timeout: 30_000 });
}

async function pickFirst(page: Page): Promise<void> {
  await page.locator('button:has(img[alt*="design preview"])').first().click();
  await page.getByRole("button", { name: /use this design/i }).click();
  await page.waitForURL(/\/easy\/[\w-]+/, { timeout: 30_000 });
}

test.describe("template & typography overhaul", () => {
  test("glossy 30 mL: long name auto-fits and detailed density shapes the reasons", async ({
    page,
  }) => {
    const longName = "Extended Recovery Peptide Concentrate";
    await startWizard(page, {
      vial: /30 mL bottle/i,
      material: /^glossy/i,
      product: longName,
      density: /lots of details/i,
    });
    // Six labeled recommendations with plain-language reasons.
    await expect(page.getByText("Best match")).toBeVisible();
    await expect(page.getByText(/^Recommended because .+\.$/).first()).toBeVisible();
    // Density answer surfaces in at least one reason sentence.
    await expect(
      page.getByText(/every detail you plan to include/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await pickFirst(page);
    // The long name survived the engine's auto-fit — nothing was truncated.
    await expect(page.getByLabel(/product name/i)).toHaveValue(longName);
    await expect(page.getByText(/preview is a simulation/i)).toBeVisible();
  });

  test("typography personalities switch the pairing without touching content", async ({
    page,
  }) => {
    await startWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Type Study",
    });
    await pickFirst(page);

    const typography = page.getByRole("region", { name: /typography/i });
    await expect(typography).toBeVisible();
    // Pick the Futuristic personality — a curated pairing applies.
    await typography.getByRole("button", { name: "Futuristic", exact: true }).click();
    await expect(
      typography.getByRole("button", { name: "Futuristic", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // "Try another font" cycles within the mood; content is untouched.
    await typography.getByRole("button", { name: /try another font/i }).click();
    await page.waitForTimeout(700);
    await expect(page.getByLabel(/product name/i)).toHaveValue("Type Study");
    // The override is undone with the reset affordance.
    await typography.getByRole("button", { name: /use this layout's font/i }).click();
    await expect(page.getByLabel(/product name/i)).toHaveValue("Type Study");
  });

  test("the 10 mL crimp-top vial gets its purpose-built template — and only that vial does", async ({
    page,
  }) => {
    await startWizard(page, {
      vial: /10 mL crimp top/i,
      material: /plain/i,
      product: "Bacteriostatic Water",
      density: /lots of details/i,
    });
    // The vial-locked layout leads with an honest reason.
    await expect(page.getByText("Best match")).toBeVisible();
    await expect(page.getByText(/designed for this exact vial/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await pickFirst(page);
    // The applied layout is the vial-locked one.
    await expect(
      page.getByRole("button", { name: "Crimp Dose", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // A different vial never sees the crimp-locked layout.
    await startWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Control Sample",
      density: /lots of details/i,
    });
    await expect(page.getByText("Best match")).toBeVisible();
    await expect(page.getByText(/designed for this exact vial/i)).toHaveCount(0);
  });

  test("transparent material with white print warns about the white backing layer", async ({
    page,
  }) => {
    await startWizard(page, {
      vial: /10 mL vial/i,
      material: /^clear$/i,
      product: "Ghost Serum",
    });
    await pickFirst(page);

    // Switch to the white-print palette — near-white art on clear film.
    await page
      .getByRole("button", { name: /use the clear with white print colors/i })
      .click();
    await page.waitForTimeout(900);

    await page.getByRole("button", { name: /download \/ print/i }).click();
    await expect(
      page.getByText(/white backing layer|white-ink layer it will be invisible/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
