import { expect, test } from "@playwright/test";

test.describe("marketing site", () => {
  test("landing page renders hero and CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /design professional vial labels/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /create your label/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /browse templates/i })).toBeVisible();
  });

  test("footer shows the compliance notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/compliance notice/i)).toBeVisible();
    await expect(
      page.getByText(/does not certify compliance with FDA/i),
    ).toBeVisible();
  });
});

test.describe("label calculator", () => {
  test("computes full-wrap dimensions from the default preset", async ({ page }) => {
    await page.goto("/tools/label-calculator");

    // 10 mL serum default: ⌀24.5 → C = 76.969 mm; width = 73.97, height = 26.
    await expect(page.getByText(/your label dimensions/i)).toBeVisible();
    await expect(page.getByText(/74\.0 ×.*26\.0 mm/)).toBeVisible();

    // Change the diameter and expect the width to update: ⌀30 → 94.25 − 3 = 91.2.
    await page.getByLabel(/body diameter/i).fill("30");
    await expect(page.getByText(/91\.2 ×.*26\.0 mm/)).toBeVisible();
  });

  test("switches display units", async ({ page }) => {
    await page.goto("/tools/label-calculator");
    await page.getByRole("radio", { name: "in" }).click();
    // 73.969 mm = 2.912 in
    await expect(page.getByText(/2\.912 ×/)).toBeVisible();
  });

  test("warns when the label is taller than the straight wall", async ({ page }) => {
    await page.goto("/tools/label-calculator");
    await page.getByLabel(/set label height manually/i).check();
    await page.getByLabel(/^label height$/i).fill("35");
    await expect(page.getByText(/exceeds the straight-wall height/i)).toBeVisible();
  });
});
