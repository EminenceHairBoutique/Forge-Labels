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
  retries: process.env.CI ? 2 : 1,
  // The single Next server saturates under many parallel editor sessions
  // (font + chunk fetches); two workers keeps runs deterministic.
  workers: 2,
  expect: { timeout: 7_500 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Pre-mark first-run onboarding as seen so the welcome dialog doesn't
    // block unrelated flows; the onboarding spec clears this itself.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [{ name: "forge-labels:onboarded:v1", value: "1" }],
        },
      ],
    },
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
