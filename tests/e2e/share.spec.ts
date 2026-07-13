import { expect, test } from "@playwright/test";

/**
 * Share links in local demo mode: every surface explains that sharing needs
 * cloud mode instead of dead-ending. (Cloud resolution paths go through the
 * get_shared_project RPC and need live Supabase — covered in docs/SETUP.md.)
 */

test.describe("share links (local mode)", () => {
  test("the public share page explains local demo mode", async ({ page }) => {
    await page.goto("/share/some-token-that-cannot-resolve");
    await expect(
      page.getByText(/sharing isn't enabled on this deployment/i),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /open the studio/i })).toBeVisible();
  });

  test("the project card share action explains cloud setup", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new label/i }).click();
    await page.getByLabel(/project name/i).fill("Share Gate Check");
    await page.getByRole("button", { name: /create & open editor/i }).click();
    await page.waitForURL(/\/editor\/[\w-]+/);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /actions for/i }).first().click();
    await page.getByRole("menuitem", { name: /share/i }).click();
    await expect(page.getByText(/sharing needs cloud mode/i)).toBeVisible();
    // Honest pointer to the local-mode alternative.
    await expect(page.getByText(/download backup/i)).toBeVisible();
  });

  test("the editor share button opens the same explainer", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new label/i }).click();
    await page.getByLabel(/project name/i).fill("Editor Share Check");
    await page.getByRole("button", { name: /create & open editor/i }).click();
    await page.waitForURL(/\/editor\/[\w-]+/);

    await page.getByRole("button", { name: /^share$/i }).click();
    await expect(page.getByText(/sharing needs cloud mode/i)).toBeVisible();
  });
});
