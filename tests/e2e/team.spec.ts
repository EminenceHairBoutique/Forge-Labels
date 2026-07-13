import { expect, test } from "@playwright/test";

/**
 * Team collaboration in local demo mode: honest cloud-required states
 * everywhere. (Membership flows need live Supabase — see docs/SETUP.md.)
 */

test.describe("team (local mode)", () => {
  test("the team page explains cloud mode and is reachable from the nav", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("navigation", { name: /^studio$/i }).getByRole("link", { name: /team/i }).click();
    await page.waitForURL(/\/team$/);
    await expect(page.getByText(/teams require cloud mode/i)).toBeVisible();
  });

  test("the invitation acceptance page explains local demo mode", async ({ page }) => {
    await page.goto("/team/accept?token=abc123def456");
    await expect(
      page.getByText(/teams aren't enabled on this deployment/i),
    ).toBeVisible();
  });

  test("the accept API returns an honest 503 without Supabase", async ({ request }) => {
    const res = await request.post("/api/team/accept", {
      data: { token: "abc123def456" },
    });
    expect(res.status()).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/cloud mode/i);
  });
});
