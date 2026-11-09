/**
 * Regenerates docs/screenshots/*.png (used in the README and PR).
 * Run: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";

test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to regenerate screenshots");

const OUT = "docs/screenshots";
const sizes = [
  { name: "mobile", width: 390, height: 844, time: "9:00 AM" },
  { name: "desktop", width: 1280, height: 860, time: "1:00 PM" },
];
const outbox = () => fs.readFileSync(".data/e2e-outbox.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const meta = () => JSON.parse(fs.readFileSync(".data/e2e-meta.json", "utf8")) as { date: string };

async function shot(page: Page, file: string) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
}

async function book(page: Page, time: string, name: string, email: string) {
  await page.goto("/demo/intro-call");
  await expect(page.getByRole("grid", { name: "Choose a day" })).toBeVisible();
  const day = page.getByRole("button", { name: new RegExp(`^${meta().date}`) });
  for (let i = 0; i < 3 && !(await day.isVisible()); i++) await page.getByRole("button", { name: "Next month" }).click();
  await day.click();
  await page.getByRole("button", { name: time, exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Property address").fill("2 Sample Ave, Anytown");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByTestId("booking-heading")).toBeVisible();
}

test("screenshots", async ({ browser }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT, { recursive: true });
  const setup = await browser.newPage({ timezoneId: "America/Chicago" });
  await book(setup, "2:00 PM", "Jordan Rivera", "jordan@example.com");
  await book(setup, "3:30 PM", "Priya Shah", "priya@example.com");
  await setup.close();

  for (const s of sizes) {
    const ctx = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: 2,
      timezoneId: "America/Chicago",
      isMobile: s.name === "mobile",
      hasTouch: s.name === "mobile",
    });
    const page = await ctx.newPage();
    await page.goto("/demo");
    await shot(page, `${s.name}-profile`);

    await page.goto("/team/example-stays/assessment");
    await expect(page.getByRole("grid", { name: "Choose a day" })).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, `${s.name}-team-event`);

    await page.goto("/api/embed-preview?style=inline&path=/demo/intro-call");
    await expect(page.frameLocator("iframe.booked-inline").getByRole("grid", { name: "Choose a day" })).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, `${s.name}-embed-inline`);

    await page.goto("/api/embed-preview?style=floating&path=/demo/intro-call&text=Book%20a%20call&color=%230f766e");
    await page.getByRole("button", { name: "Book a call" }).click();
    await expect(page.frameLocator(".booked-panel iframe").getByRole("grid", { name: "Choose a day" })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${s.name}-embed-popup.png` });

    await page.goto("/demo/intro-call");
    await expect(page.getByRole("grid", { name: "Choose a day" })).toBeVisible();
    const day = page.getByRole("button", { name: new RegExp(`^${meta().date}`) });
    for (let i = 0; i < 3 && !(await day.isVisible()); i++) await page.getByRole("button", { name: "Next month" }).click();
    await day.click();
    await shot(page, `${s.name}-booking-page`);

    await page.getByRole("button", { name: s.time, exact: true }).click();
    await page.getByLabel("Your name").fill("Sam Guest");
    await page.getByLabel("Email").fill("sam@example.com");
    await shot(page, `${s.name}-booking-form`);
    await page.getByLabel("Property address").fill("1 Example Rd, Anytown");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByTestId("booking-heading")).toBeVisible();
    await shot(page, `${s.name}-confirmed`);

    // Admin
    await page.goto("/login");
    await page.getByLabel("Your email").fill("demo@example.com");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    const link = outbox().reverse().find((m) => m.subject.includes("sign-in link")).text.match(/https?:\/\/\S+/)[0];
    await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
    await page.getByRole("button", { name: "Continue to my dashboard" }).click();
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
    await shot(page, `${s.name}-admin-bookings`);
    if (s.name === "desktop") {
      await page.goto("/admin/events/demo-intro");
      await shot(page, "desktop-admin-event");
      await page.goto("/admin/availability");
      await shot(page, "desktop-admin-availability");
      await page.goto("/admin/settings");
      await shot(page, "desktop-admin-settings");
      await page.goto("/admin/team");
      await shot(page, "desktop-admin-team");
      await page.goto("/admin/embed");
      await page.getByText("Floating button").click();
      await expect(page.frameLocator(".preview-frame").getByRole("button", { name: "Book a call" })).toBeVisible();
      await shot(page, "desktop-admin-embed");
    }
    await ctx.close();
  }
});
