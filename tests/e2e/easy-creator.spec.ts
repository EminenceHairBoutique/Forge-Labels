import { expect, test, type Page } from "@playwright/test";

/**
 * Easy Creator core flows (B1): the guided wizard, the form-based editor,
 * draft persistence, and the Easy ↔ Advanced round-trip. The full §23
 * beginner matrix lands with B6; these are the architecture guarantees.
 */

async function runWizard(
  page: Page,
  options: {
    vial: RegExp;
    material: RegExp;
    industry?: RegExp;
    style?: RegExp;
    product?: string;
    density?: RegExp;
  },
): Promise<void> {
  await page.goto("/create");
  await page.getByRole("button", { name: options.vial }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();

  // "What type of label are you creating?" — the purpose step.
  await page
    .getByRole("button", { name: options.industry ?? /general product/i })
    .click();
  await page.getByRole("button", { name: /^continue$/i }).click();

  await page.getByRole("button", { name: options.material }).first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();

  if (options.style) {
    await page.getByRole("button", { name: options.style }).click();
  }
  if (options.product) {
    await page.getByLabel(/product name/i).fill(options.product);
  }
  await page.getByRole("button", { name: /^continue$/i }).click();

  // "What needs to fit?" — the standard amount is the default.
  await expect(page.getByText(/what needs to fit\?/i)).toBeVisible();
  if (options.density) {
    await page.getByRole("button", { name: options.density }).click();
  }
  await page.getByRole("button", { name: /show my designs/i }).click();

  // Recommendations render real thumbnails — give fonts/canvas time.
  await page
    .locator('img[alt*="design preview"]')
    .first()
    .waitFor({ timeout: 30_000 });
  await page.locator('button:has(img[alt*="design preview"])').first().click();
  await page.getByRole("button", { name: /use this design/i }).click();
  await page.waitForURL(/\/easy\/[\w-]+/, { timeout: 30_000 });
}

test.describe("easy creator wizard", () => {
  test("creates a 10 mL holographic label without an account", async ({ page }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /holographic/i,
      style: /futuristic/i,
      product: "Peptide Complex",
    });
    // The Easy editor opens with the form populated and the preview live.
    await expect(page.getByLabel(/product name/i)).toHaveValue("Peptide Complex");
    await expect(page.getByText(/preview is a simulation/i)).toBeVisible();
    // No canvas editor chrome anywhere in sight.
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test("wizard progress survives a refresh (draft persistence)", async ({ page }) => {
    await page.goto("/create");
    await page.getByRole("button", { name: /20 mL vial/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /general product/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /^neon/i }).first().click();

    await page.reload();
    // Still on the material step with the choice intact.
    await expect(page.getByRole("button", { name: /^neon/i }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByText(/tell us about the product/i)).toBeVisible();
  });

  test("plain-language measurements accept a circumference, not a diameter", async ({
    page,
  }) => {
    await page.goto("/create");
    await page.getByRole("button", { name: /something else/i }).click();
    await page.getByRole("button", { name: /yes, enter them/i }).click();
    await page.getByLabel(/around the vial/i).fill("77");
    await page.getByLabel(/straight side height/i).fill("30");
    await page.getByLabel(/straight side height/i).blur();
    // Technical dimensions stay behind a disclosure and derive from π.
    await page.getByText(/view technical dimensions/i).click();
    await expect(page.getByText(/label 7\d\.\d × /i)).toBeVisible();
  });
});

test.describe("easy editor", () => {
  test("form edits update the document and one undo reverts one edit", async ({
    page,
  }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Retinol Serum",
    });
    const product = page.getByLabel(/product name/i);
    await product.fill("Retinol Serum Pro");
    // Debounce + engine pass.
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /^undo$/i }).click();
    await expect(product).toHaveValue("Retinol Serum");
  });

  test("round-trips to the Advanced Editor and back without loss", async ({ page }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Roundtrip Serum",
    });
    const projectId = page.url().split("/easy/")[1]!;

    // Two affordances exist by design (top bar + footer note) — either works.
    await page.getByRole("link", { name: /advanced editor/i }).first().click();
    await page.waitForURL(`**/editor/${projectId}`);
    await expect(
      page.locator('[data-testid="editor-canvas"] canvas').first(),
    ).toBeVisible();
    // The same document is open — the product name is a normal text object
    // in the layers panel.
    await page.getByRole("tab", { name: /layers/i }).click();
    await expect(page.getByText(/roundtrip serum/i).first()).toBeVisible();

    // The top bar offers the way back.
    await page.getByRole("link", { name: /easy mode/i }).click();
    await page.waitForURL(`**/easy/${projectId}`);
    await expect(page.getByLabel(/product name/i)).toHaveValue("Roundtrip Serum");
  });

  test("one-click fixes apply, persist, and Simplify stashes values reversibly", async ({
    page,
  }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Fixable Serum",
    });

    // Turn on the subtitle with a value.
    await page
      .getByRole("switch", { name: /show short subtitle/i })
      .click();
    await page.getByLabel("Short subtitle", { exact: true }).fill("Overnight renewal");
    await page.waitForTimeout(900);

    // Simplify turns the nice-to-haves off…
    await page.getByRole("button", { name: /^simplify$/i }).click();
    await page.waitForTimeout(600);
    await expect(page.getByRole("switch", { name: /show short subtitle/i })).not.toBeChecked();

    // …and toggling back on restores the stashed text.
    await page.getByRole("switch", { name: /show short subtitle/i }).click();
    await page.waitForTimeout(600);
    await expect(page.getByLabel("Short subtitle", { exact: true })).toHaveValue(
      "Overnight renewal",
    );

    // Bigger product name persists as a tweak and offers a reset.
    await page.getByRole("button", { name: /bigger product name/i }).click();
    await page.waitForTimeout(600);
    await expect(page.getByRole("button", { name: /reset fixes/i })).toBeVisible();
    await page.getByRole("button", { name: /fit everything/i }).click();
    await page.waitForTimeout(600);
    await expect(
      page.getByRole("button", { name: /fit everything/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("material changes after creation, with an honest holographic intensity control", async ({
    page,
  }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Switcher",
    });
    await page.getByRole("button", { name: /change material/i }).click();
    // Plain has no varying effect — no intensity control.
    await expect(page.getByText(/how much holographic effect/i)).toHaveCount(0);

    await page.getByRole("button", { name: /holographic/i }).first().click();
    await expect(page.getByText(/how much holographic effect/i)).toBeVisible();
    await expect(page.getByText(/simulation/i).first()).toBeVisible();
    await page.getByRole("button", { name: /^maximum$/i }).click();
    // The engine pass lands as a document change (undo becomes available).
    await page.waitForTimeout(600);
    await expect(page.getByRole("button", { name: /^undo$/i })).toBeEnabled();
  });

  test("advanced-only projects redirect to the Advanced Editor", async ({ page }) => {
    // Created through the classic dialog — no Easy metadata.
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new label/i }).click();
    await page.getByLabel(/project name/i).fill("Classic Project");
    await page.getByRole("button", { name: /create & open editor/i }).click();
    await page.waitForURL(/\/editor\/[\w-]+/);
    const projectId = page.url().split("/editor/")[1]!;

    await page.goto(`/easy/${projectId}`);
    await page.waitForURL(`**/editor/${projectId}`);
  });
});

test.describe("design variations and product family", () => {
  test("layouts switch with content intact, and tone flips dark/light", async ({
    page,
  }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Variant Serum",
    });
    // Switch to a different layout family through the template browser —
    // the words survive and the picked layout becomes current.
    await page.getByRole("button", { name: /browse all templates/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /^Type stack — / }).click();
    await page.getByRole("button", { name: /use this template/i }).click();
    await page.waitForTimeout(900);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel(/product name/i)).toHaveValue("Variant Serum");
    await expect(
      page.getByRole("button", { name: "Type stack", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Tone flip is offered and applies (start tone depends on the pick).
    const flip = page.getByRole("button", { name: /try a (dark|light) version/i });
    const before = (await flip.textContent()) ?? "";
    await flip.click();
    await page.waitForTimeout(700);
    const after = (await flip.textContent()) ?? "";
    expect(after).not.toBe(before); // dark ⇄ light swapped
  });

  test("creates a matching product label preserving the brand", async ({ page }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Line Serum A",
    });
    await page.getByRole("button", { name: /matching label/i }).click();
    await page.getByLabel(/product name/i).last().fill("Line Serum B");
    await page.getByLabel("Strength", { exact: true }).fill("20 mg");
    await page.getByRole("button", { name: /create matching label/i }).click();
    await page.waitForURL(/\/easy\/[\w-]+/, { timeout: 20_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0); // dialog fully closed
    // The new project opens with the new product name and the same brand.
    await expect(page.getByLabel(/product name/i)).toHaveValue("Line Serum B");
    await expect(page.getByLabel(/brand name/i)).toHaveValue("YOUR BRAND");
    await expect(page.getByLabel("Amount or strength", { exact: true })).toHaveValue(
      "20 mg",
    );
  });
});

test.describe("plain-language print experience", () => {
  test("exports a home-print sheet from a plain white label", async ({ page }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Home Print Serum",
    });
    await page.getByRole("button", { name: /download \/ print/i }).click();
    await expect(page.getByText(/how will you use your label\?/i)).toBeVisible();
    await page.getByRole("button", { name: /print at home/i }).click();
    await page.getByRole("button", { name: /US Letter/i }).click();

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

  test("warns in plain language and one-click fixes the QR size", async ({ page }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "QR Serum",
    });
    // Enable a QR — on a small vial its modules start below the floor.
    await page.getByRole("switch", { name: /show qr code/i }).click();
    await page.getByLabel("QR code", { exact: true }).fill("https://example.com");
    await page.waitForTimeout(900);

    await page.getByRole("button", { name: /download \/ print/i }).click();
    await expect(page.getByText(/too small to scan reliably/i)).toBeVisible();
    // No jargon anywhere in the checks list.
    await expect(page.getByText(/module/i)).toHaveCount(0);

    await page.getByRole("button", { name: /make the qr code bigger/i }).click();
    await expect(page.getByText(/too small to scan reliably/i)).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("professional package bundles the PDF with a specification sheet", async ({
    page,
  }) => {
    await runWizard(page, {
      vial: /10 mL vial/i,
      material: /plain/i,
      product: "Pro Pack Serum",
    });
    await page.getByRole("button", { name: /download \/ print/i }).click();
    await page.getByRole("button", { name: /professional printer/i }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /download printer package/i }).click();
    expect((await download).suggestedFilename()).toMatch(/for-printer\.zip$/);
  });
});

test.describe("onboarding", () => {
  test("welcomes first-time visitors once, with a plain 5-step promise", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.removeItem("forge-labels:onboarded:v1"));
    await page.reload();
    await expect(page.getByText(/welcome to forge labels/i)).toBeVisible();
    // Scoped to the dialog: the dashboard empty state repeats the promise.
    await expect(
      page.getByRole("dialog").getByText(/you don't need design experience/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /skip for now/i }).click();
    await expect(page.getByText(/welcome to forge labels/i)).toHaveCount(0);
    await page.reload();
    // The first-run check is deferred a tick — give it time to (not) fire.
    await page.waitForTimeout(1200);
    await expect(page.getByText(/welcome to forge labels/i)).toHaveCount(0);
  });
});

test.describe("beginner dashboard", () => {
  test("empty state asks what to make and leads with the guided flow", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/what would you like to make\?/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /make my first label/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start from a template/i })).toBeVisible();
    await page.getByRole("link", { name: /make a new label/i }).click();
    await page.waitForURL(/\/create/);
    await expect(page.getByText(/what are you labeling\?/i)).toBeVisible();
  });
});
