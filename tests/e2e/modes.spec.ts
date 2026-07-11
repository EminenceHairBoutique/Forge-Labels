import { expect, test } from "@playwright/test";

/**
 * Local demo mode must be honest: every cloud-dependent surface explains what
 * it needs instead of faking or hiding functionality. (Cloud mode itself needs
 * live Supabase credentials, so CI exercises the local side — see
 * docs/PRODUCTION-READINESS.md.)
 */

test.describe("local demo mode states", () => {
  test("studio shows the local-mode banner", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/local demo mode/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /connect supabase/i }),
    ).toBeVisible();
  });

  test("auth routes explain demo mode instead of showing a dead form", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByText(/accounts aren't set up yet/i)).toBeVisible();
    // No fake credential inputs.
    await expect(page.getByLabel(/email/i)).toHaveCount(0);
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
    // The visitor is routed somewhere real.
    await page.getByRole("link", { name: /continue to the studio/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test("billing explains cloud setup and still shows real plans", async ({
    page,
  }) => {
    await page.goto("/billing");
    await expect(page.getByText(/billing needs cloud setup/i)).toBeVisible();
    // Plan cards render from the seed definitions (pricing is data, not UI copy).
    await expect(page.getByRole("heading", { name: /^pro$/i })).toBeVisible();
    // No checkout buttons in local mode — they'd be dead ends.
    await expect(page.getByRole("button", { name: /upgrade to/i })).toHaveCount(0);
  });

  test("admin explains that it requires cloud mode", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText(/admin requires cloud mode/i)).toBeVisible();
  });
});

test.describe("accessibility basics", () => {
  test("keyboard users get a skip link to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /skip to content/i });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("studio pages expose the skip link and a main landmark", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: /skip to content/i }),
    ).toBeFocused();
    await expect(page.locator("main#main")).toBeVisible();
  });

  test("editor toolbar buttons are labeled for assistive tech", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new label/i }).click();
    await page.getByLabel(/project name/i).fill("A11y Check");
    await page.getByRole("button", { name: /create & open editor/i }).click();
    await page.waitForURL(/\/editor\/[\w-]+/);
    const toolbar = page.getByRole("toolbar", { name: /insert objects/i });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /add text/i })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /add qr code/i })).toBeVisible();
  });
});
