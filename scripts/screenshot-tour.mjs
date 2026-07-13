import { chromium } from "@playwright/test";

const base = "http://localhost:3100";
const outDir = "docs/screenshots";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
});

async function shoot(name, viewport, fn) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await fn(page);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await ctx.close();
  console.log(name, "done");
}

const desktop = { width: 1440, height: 900 };
const iphone = { width: 390, height: 844 };

await shoot("before-dashboard-desktop", desktop, async (page) => {
  await page.goto(`${base}/dashboard`);
  await page.waitForLoadState("networkidle");
});

await shoot("before-new-label-dialog", desktop, async (page) => {
  await page.goto(`${base}/dashboard`);
  await page.getByRole("button", { name: /new label/i }).first().click();
  await page.getByLabel(/project name/i).waitFor();
  await page.waitForTimeout(400);
});

await shoot("before-editor-desktop", desktop, async (page) => {
  await page.goto(`${base}/dashboard`);
  await page.getByRole("button", { name: /new label/i }).first().click();
  await page.getByLabel(/project name/i).fill("Audit Baseline");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\//);
  await page.locator('[data-testid="editor-canvas"] canvas').first().waitFor();
  await page.waitForTimeout(800);
});

await shoot("before-editor-iphone", iphone, async (page) => {
  await page.goto(`${base}/dashboard`);
  await page.getByRole("button", { name: /new label/i }).first().click();
  await page.getByLabel(/project name/i).fill("Audit Mobile");
  await page.getByRole("button", { name: /create & open editor/i }).click();
  await page.waitForURL(/\/editor\//);
  await page.waitForTimeout(1200);
});

await shoot("before-templates-desktop", desktop, async (page) => {
  await page.goto(`${base}/templates`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
});

await shoot("before-dashboard-iphone", iphone, async (page) => {
  await page.goto(`${base}/dashboard`);
  await page.waitForLoadState("networkidle");
});

await browser.close();
