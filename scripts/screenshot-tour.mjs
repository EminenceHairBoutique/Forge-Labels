// Screenshot tour for docs/screenshots — run against a built app:
//   npx next start -p 3100 &   then   node scripts/screenshot-tour.mjs after
// The "before" set (pre-overhaul) is kept in git for §25's comparison.
import { chromium } from "@playwright/test";

const prefix = process.argv[2] ?? "after";
const base = "http://localhost:3100";
const outDir = "docs/screenshots";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
});

async function shoot(name, viewport, fn) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: base,
          localStorage: [{ name: "forge-labels:onboarded:v1", value: "1" }],
        },
      ],
    },
  });
  const page = await ctx.newPage();
  await fn(page);
  await page.screenshot({ path: `${outDir}/${prefix}-${name}.png` });
  await ctx.close();
  console.log(`${prefix}-${name} done`);
}

const desktop = { width: 1440, height: 900 };
const iphone = { width: 390, height: 844 };

async function runWizardToNeeds(page) {
  await page.goto(`${base}/create`);
  await page.getByRole("button", { name: /10 mL vial/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /biotechnology/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /holographic/i }).first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /futuristic/i }).click();
  await page.getByLabel(/brand name/i).fill("VANTA RESEARCH");
  await page.getByLabel(/product name/i).fill("Peptide Complex");
  await page.getByLabel(/amount or strength/i).fill("10 mg");
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByText(/what needs to fit/i).waitFor();
}

async function runWizardToPick(page) {
  await runWizardToNeeds(page);
  await page.getByRole("button", { name: /show my designs/i }).click();
  await page.locator('img[alt*="design preview"]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
}

async function openEasyEditor(page) {
  await runWizardToPick(page);
  await page.locator('button:has(img[alt*="design preview"])').first().click();
  await page.getByRole("button", { name: /use this design/i }).click();
  await page.waitForURL(/\/easy\//, { timeout: 30000 });
  await page.waitForTimeout(4500);
}

await shoot("dashboard-desktop", desktop, async (page) => {
  await page.goto(`${base}/dashboard`);
  await page.waitForLoadState("networkidle");
});

await shoot("onboarding", desktop, async (page) => {
  await page.goto(`${base}/dashboard`);
  await page.evaluate(() => localStorage.removeItem("forge-labels:onboarded:v1"));
  await page.reload();
  await page.getByText(/welcome to forge labels/i).waitFor();
  await page.waitForTimeout(400);
});

await shoot("wizard-vial-iphone", iphone, async (page) => {
  await page.goto(`${base}/create`);
  await page.getByRole("button", { name: /10 mL vial/i }).click();
  await page.waitForTimeout(400);
});

await shoot("wizard-industry-desktop", desktop, async (page) => {
  await page.goto(`${base}/create`);
  await page.getByRole("button", { name: /10 mL vial/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /research peptide/i }).click();
  await page.waitForTimeout(400);
});

await shoot("wizard-material-desktop", desktop, async (page) => {
  await page.goto(`${base}/create`);
  await page.getByRole("button", { name: /10 mL vial/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /general product/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /holographic/i }).first().click();
  await page.waitForTimeout(600);
});

await shoot("wizard-needs-desktop", desktop, async (page) => {
  await runWizardToNeeds(page);
  await page.getByRole("switch", { name: /qr code/i }).click();
  await page.waitForTimeout(400);
});

await shoot("wizard-pick-desktop", desktop, runWizardToPick);

await shoot("easy-editor-desktop", desktop, openEasyEditor);

await shoot("easy-editor-iphone", iphone, openEasyEditor);

await shoot("typography-desktop", desktop, async (page) => {
  await openEasyEditor(page);
  const section = page.locator('section[aria-label="Typography"]');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
});

await shoot("template-browser-desktop", desktop, async (page) => {
  await openEasyEditor(page);
  await page.getByRole("button", { name: /browse all templates/i }).click();
  await page.locator('img[alt*="preview"]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
});

await shoot("library-iphone", iphone, async (page) => {
  await page.goto(`${base}/library`);
  await page.locator('img[alt*="preview"]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
});

await shoot("export-wizard", desktop, async (page) => {
  await openEasyEditor(page);
  await page.getByRole("button", { name: /download \/ print/i }).click();
  await page.getByText(/how will you use your label/i).waitFor();
  await page.waitForTimeout(400);
});

await browser.close();
