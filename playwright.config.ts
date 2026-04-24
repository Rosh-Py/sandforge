import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E tests.
 *
 * Runs against the Vite dev server. Tests live in src/__tests__/e2e/.
 */
export default defineConfig({
  testDir: "./src/__tests__/e2e",
  fullyParallel: false, // Sandbox tests can conflict if parallel
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
