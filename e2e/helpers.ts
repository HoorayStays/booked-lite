import { expect, type Page, type FrameLocator } from "@playwright/test";
import fs from "node:fs";

export const meta = () => JSON.parse(fs.readFileSync(".data/e2e-meta.json", "utf8")) as { date: string };
export const calendar = () => JSON.parse(fs.readFileSync(".data/e2e-calendar.json", "utf8"));
export const zoom = () => (fs.existsSync(".data/e2e-zoom.json") ? JSON.parse(fs.readFileSync(".data/e2e-zoom.json", "utf8")) : {});
export const outbox = () =>
  fs.existsSync(".data/e2e-outbox.jsonl")
    ? fs.readFileSync(".data/e2e-outbox.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];

/** Opens the test day in the booking calendar (moving to next month if needed). */
export async function openDay(page: Page | FrameLocator, date = meta().date) {
  await expect(page.getByRole("grid", { name: "Choose a day" })).toBeVisible();
  const dayButton = page.getByRole("button", { name: new RegExp(`^${date}`) });
  for (let i = 0; i < 3 && !(await dayButton.isVisible()); i++) {
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.getByRole("grid", { name: "Choose a day" })).toBeVisible();
  }
  await expect(dayButton).toBeEnabled();
  await dayButton.click();
}

export async function fillGuest(page: Page | FrameLocator, name: string, email: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
}
