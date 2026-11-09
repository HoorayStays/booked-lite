import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** Everything the test server needs. No real accounts: fake calendar + emails written to a file. */
export const E2E_ENV = {
  DATABASE_URL: "file:.data/e2e.db",
  CALENDAR_PROVIDER: "fake",
  FAKE_CALENDAR_FILE: ".data/e2e-calendar.json",
  OUTBOX_FILE: ".data/e2e-outbox.jsonl",
  ALLOWED_EMAILS: "demo@example.com",
  AUTH_SECRET: "e2e-test-secret-not-for-production",
  APP_URL: `http://localhost:${PORT}`,
  RESEND_API_KEY: "",
  GOOGLE_CLIENT_ID: "",
  E2E: "1",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "America/Chicago",
    locale: "en-US",
    trace: "off",
  },
  testIgnore: process.env.SCREENSHOTS ? [] : ["**/screenshots.spec.ts"],
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], timezoneId: "America/Chicago" } },
  ],
  webServer: {
    command: `npx tsx e2e/prepare.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/demo`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: E2E_ENV,
    stdout: "pipe",
  },
});
