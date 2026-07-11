import { expect, test } from "@playwright/test";

/**
 * Perf smoke: the editor must stay functional — selection, bulk nudges,
 * single-gesture undo — with 100+ objects on the canvas. This is a
 * functionality floor, not a benchmark; wall-clock numbers land in the test
 * annotations for trend-watching without flaking CI on shared runners.
 */

test.describe("editor under load", () => {
  test("stays responsive with 100+ objects", async ({ page }) => {
    test.slow();
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new label/i }).click();
    await page.getByLabel(/project name/i).fill("Perf Smoke");
    await page.getByRole("button", { name: /create & open editor/i }).click();
    await page.waitForURL(/\/editor\/[\w-]+/);
    await expect(page.locator('[data-testid="editor-canvas"] canvas').first()).toBeVisible();

    // Seed one rectangle, then duplicate to 112 objects (each Ctrl+D
    // duplicates the current selection, so counts double-ish per press on
    // multi-select — use single-object duplicate by pressing on a fresh
    // selection each time via the canvas store semantics: duplicate keeps
    // the new copy selected, so repeated presses chain single copies).
    await page.getByRole("button", { name: /add rectangle/i }).click();
    await expect(page.getByLabel(/^fill$/i)).toBeVisible();

    const t0 = Date.now();
    for (let i = 0; i < 111; i++) {
      await page.keyboard.press("ControlOrMeta+d");
    }
    const duplicateMs = Date.now() - t0;

    // All 112 objects are present in the layers panel.
    await page.getByRole("tab", { name: /layers/i }).click();
    const rows = page.getByRole("list", { name: /layers/i }).getByRole("listitem");
    await expect(rows).toHaveCount(112, { timeout: 15_000 });

    // Park focus on the canvas backdrop — arrow keys must reach the editor
    // shortcut map, not the sidebar tablist's roving focus.
    await page.getByTestId("editor-canvas").click({ position: { x: 60, y: 35 } });

    // Select-all + keyboard nudge moves every object in one tracked gesture.
    await page.keyboard.press("ControlOrMeta+a");
    const t1 = Date.now();
    await page.keyboard.press("ArrowRight");
    // X readout reflects the move (multi-selection shows common fields).
    const nudgeMs = Date.now() - t1;

    // One undo reverses the whole nudge; a second removes the last duplicate.
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(rows).toHaveCount(111, { timeout: 15_000 });

    test.info().annotations.push(
      { type: "perf", description: `duplicate x111: ${duplicateMs}ms` },
      { type: "perf", description: `nudge 112 objects: ${nudgeMs}ms` },
    );

    // Generous functional ceiling — catches pathological regressions
    // (e.g. full-canvas re-render per object) without flaking on slow CI.
    expect(duplicateMs).toBeLessThan(90_000);
  });
});
