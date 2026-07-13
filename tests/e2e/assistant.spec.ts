import { expect, test } from "@playwright/test";

/**
 * AI assistant in an unconfigured deployment: the tab exists, explains
 * exactly what's missing, and the API refuses honestly. (Live-key behavior
 * can't run in CI — verification steps live in docs/SETUP.md.)
 */

test.describe("assistant (no API key)", () => {
  test("the status API reports unconfigured and the chat API 503s", async ({ request }) => {
    const status = await request.get("/api/assistant/status");
    expect(status.status()).toBe(200);
    const body = (await status.json()) as { configured: boolean; mode: string };
    expect(body.configured).toBe(false);
    expect(body.mode).toBe("local");

    const chat = await request.post("/api/assistant", {
      data: { messages: [{ role: "user", content: "hello" }] },
    });
    expect(chat.status()).toBe(503);
    const err = (await chat.json()) as { error: string };
    expect(err.error).toContain("ANTHROPIC_API_KEY");
  });

  test("the editor's AI tab shows the honest key-gated state", async ({ page }) => {
    await page.goto("/dashboard");
    // The empty dashboard renders the header + empty-state "New label"
    // buttons — either one opens the same dialog.
    await page.getByRole("button", { name: /new label/i }).first().click();
    await page.getByLabel(/project name/i).fill("Assistant Gate");
    await page.getByRole("button", { name: /create & open editor/i }).click();
    await page.waitForURL(/\/editor\/[\w-]+/);
    await expect(page.getByTestId("editor-canvas")).toBeVisible();

    await page.getByRole("tab", { name: /^ai$/i }).click();
    await expect(page.getByText(/assistant not configured/i)).toBeVisible();
    await expect(page.getByText(/ANTHROPIC_API_KEY/)).toBeVisible();
    // Honest gate: no chat input is offered without the key.
    await expect(page.getByLabel(/message the assistant/i)).toHaveCount(0);
  });
});
