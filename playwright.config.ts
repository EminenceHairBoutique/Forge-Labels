import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3100";
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Sandboxed dev environments pre-install Chromium at a fixed path instead of
// the per-version Playwright cache. CI installs matching browsers normally.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath =
  !process.env.CI && existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
