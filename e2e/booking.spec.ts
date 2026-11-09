import { test, expect } from "@playwright/test";
import { calendar, meta, openDay, outbox } from "./helpers";

test("a guest books, gets an email + calendar event, and can cancel", async ({ page }) => {
  const { date } = meta();
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Sunny Stays Co." })).toBeVisible();
  await expect(page.getByText("Built by")).toBeVisible();
  await page.getByRole("link", { name: /Owner intro call/ }).click();

  await expect(page.getByRole("heading", { name: "Owner intro call" })).toBeVisible();
  await openDay(page, date);

  // The fake calendar is busy 10:00–12:00, and this event has a 10-minute buffer after.
  await expect(page.getByRole("button", { name: "9:00 AM" })).toBeVisible();
  for (const t of ["9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"]) {
    await expect(page.getByRole("button", { name: t, exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "1:00 PM", exact: true }).click();

  await expect(page.getByTestId("selected-time")).toContainText("1:00 PM");
  await page.getByLabel("Your name").fill("Sam Guest");
  await page.getByLabel("Email").fill("sam@example.com");
  await page.getByLabel("Property address").fill("12 Beach Rd, Galveston");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByTestId("booking-heading")).toHaveText("You're booked! 🎉");
  await expect(page.getByTestId("booking-when")).toContainText("1:00 PM");
  // No verified email domain in tests → guests are told to save the page.
  await expect(page.getByTestId("save-this-page")).toBeVisible();
  await expect(page.getByRole("link", { name: /meet\.jit\.si/ })).toBeVisible();

  // Written to the (fake) calendar…
  const events = calendar().events;
  expect(events).toHaveLength(1);
  expect(events[0].title).toBe("Owner intro call with Sam Guest");
  expect(events[0].attendee.email).toBe("sam@example.com");

  // …and emails went out: guest confirmation with an .ics invite, plus a note to the host.
  const mail = outbox();
  const guest = mail.find((m) => m.to === "sam@example.com");
  expect(guest.subject).toContain("Confirmed: Owner intro call");
  expect(guest.attachments[0].content).toContain("BEGIN:VCALENDAR");
  expect(guest.text).toContain("Reschedule:");
  expect(mail.find((m) => m.to === "demo@example.com").subject).toContain("New booking");

  // The booked time disappears for the next visitor.
  await page.goto("/demo/intro-call");
  await openDay(page, date);
  await expect(page.getByRole("button", { name: "2:00 PM", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "1:00 PM", exact: true })).toHaveCount(0);

  // Guest cancels from the link in their email.
  const manage = guest.text.match(/Cancel: (\S+)/)[1].replace(/^https?:\/\/[^/]+/, "");
  await page.goto(manage);
  await page.getByRole("link", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Yes, cancel booking" }).click();
  await expect(page.getByRole("heading", { name: "This booking is cancelled" })).toBeVisible();
  expect(calendar().events).toHaveLength(0);
});

test("the host signs in with a magic link and sees bookings", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Your email").fill("demo@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("on its way");

  const login = outbox().reverse().find((m) => m.subject.includes("sign-in link"));
  const link = login.text.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/]+/, "");
  await page.goto(link);
  await page.getByRole("button", { name: "Continue to my dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
  await page.getByRole("link", { name: "Past" }).click();
  await page.getByRole("link", { name: "Event types" }).click();
  await expect(page.getByRole("link", { name: "Owner intro call" })).toBeVisible();
});
