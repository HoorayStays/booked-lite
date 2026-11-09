import { test, expect } from "@playwright/test";
import { calendar, fillGuest, openDay, outbox, zoom } from "./helpers";

// Demo team (see scripts/seed.ts): Sunny Stays Co. works 9–5 Chicago, Jordan works 9–5 Denver (= 10–6 Chicago).
// The fake calendar is busy 10:00–12:00 Chicago for both on the test day.

test("round robin: guests go to whoever is free, taking turns", async ({ page }) => {
  await page.goto("/team/sunny-stays");
  await expect(page.getByRole("heading", { name: "Sunny Stays Team" })).toBeVisible();
  await page.getByRole("link", { name: /Free property assessment/ }).click();
  await openDay(page);
  // Union of both people's hours: 9:00 (only the owner) and 5:30 PM (only Jordan) are both offered.
  await expect(page.getByRole("button", { name: "9:00 AM", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "5:30 PM", exact: true })).toBeVisible();

  const hosts: string[] = [];
  for (const guest of ["Ana", "Ben"]) {
    await page.goto("/team/sunny-stays/assessment");
    await openDay(page);
    await page.getByRole("button", { name: "2:00 PM", exact: true }).click();
    await fillGuest(page, guest, `${guest.toLowerCase()}@example.com`);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByTestId("booking-heading")).toBeVisible();
    // Google Meet link created through the host's (fake) Google Calendar.
    await expect(page.getByTestId("booking-where")).toContainText("meet.google.com");
    hosts.push((await page.getByText(/Free property assessment/).locator("..").textContent()) ?? "");
  }
  expect(hosts[0]).toContain("Jordan Lee");
  expect(hosts[1]).toContain("Sunny Stays Co.");
  // Each host got the event on their own calendar.
  const events = calendar().events.filter((e: { title: string }) => e.title.startsWith("Free property assessment"));
  expect(new Set(events.map((e: { userId: string }) => e.userId)).size).toBe(2);

  // Both people are now busy at 2:00, so it's no longer offered.
  await page.goto("/team/sunny-stays/assessment");
  await openDay(page);
  await expect(page.getByRole("button", { name: "2:30 PM", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "2:00 PM", exact: true })).toHaveCount(0);
});

test("everyone-together events only offer times when the whole team is free", async ({ page }) => {
  await page.goto("/team/sunny-stays/kickoff");
  await openDay(page);
  await expect(page.getByRole("button", { name: "12:00 PM", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "9:00 AM", exact: true })).toHaveCount(0); // Jordan isn't working yet
  await expect(page.getByRole("button", { name: "5:00 PM", exact: true })).toHaveCount(0); // the owner has finished
  await page.getByRole("button", { name: "12:00 PM", exact: true }).click();
  await fillGuest(page, "Cara Owner", "cara@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText(/with Sunny Stays Co\. & Jordan Lee|with Jordan Lee & Sunny Stays Co\./)).toBeVisible();
  const hostMails = outbox().filter((m) => m.subject.startsWith("New booking: Owner kickoff"));
  expect(hostMails.map((m) => m.to).sort()).toEqual(["demo@example.com", "jordan@example.com"]);
});

test("Zoom: a unique meeting is created, moved on reschedule and deleted on cancel", async ({ page }) => {
  await page.goto("/demo/zoom-consult");
  await openDay(page);
  await page.getByRole("button", { name: "3:00 PM", exact: true }).click();
  await fillGuest(page, "Zed Zoom", "zed@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByTestId("booking-where")).toContainText("zoom.us/j/");
  await expect(page.getByTestId("booking-where")).toContainText("Passcode:");
  const [meeting] = Object.values(zoom()) as { id: string; start: number; password: string }[];
  expect(meeting).toBeTruthy();

  const mail = outbox().find((m) => m.to === "zed@example.com" && m.subject.startsWith("Confirmed"));
  expect(mail.text).toContain(`passcode: ${meeting.password}`);
  expect(mail.attachments[0].content).toContain("zoom.us/j/");

  // Reschedule to 4:00 PM → the same Zoom meeting moves.
  await page.getByRole("link", { name: "Reschedule" }).click();
  await openDay(page);
  await page.getByRole("button", { name: "4:00 PM", exact: true }).click();
  await page.getByRole("button", { name: "Confirm new time" }).click();
  await expect(page.getByTestId("booking-when")).toContainText("4:00 PM");
  const moved = zoom()[meeting.id];
  expect(moved.start).toBe(meeting.start + 3_600_000);

  // Cancel → the Zoom meeting is deleted.
  await page.getByRole("link", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Yes, cancel booking" }).click();
  await expect(page.getByRole("heading", { name: "This booking is cancelled" })).toBeVisible();
  expect(zoom()[meeting.id]).toBeUndefined();
});

test("embed widget: inline and popup work on another website", async ({ page }) => {
  // Inline: the booking page inside the site, growing to fit.
  await page.goto("/api/embed-preview?style=inline&path=/demo/quick-call");
  const inline = page.locator("iframe.booked-inline");
  await expect(inline).toBeVisible();
  await expect.poll(async () => (await inline.boundingBox())?.height ?? 0).toBeGreaterThan(400);
  await expect(page.frameLocator("iframe.booked-inline").getByRole("heading", { name: "15-minute phone call" })).toBeVisible();

  // Floating button → popup → book inside it.
  await page.goto("/api/embed-preview?style=floating&path=/demo/quick-call&text=Book%20a%20call&color=%23e11d48");
  const btn = page.getByRole("button", { name: "Book a call" });
  await expect(btn).toHaveCSS("background-color", "rgb(225, 29, 72)");
  await btn.click();
  const popup = page.frameLocator(".booked-panel iframe");
  await openDay(popup);
  await popup.getByRole("button", { name: "4:30 PM", exact: true }).click();
  await fillGuest(popup, "Embed Guest", "embed@example.com");
  await popup.getByLabel("Phone number").fill("+1 555 0100");
  await popup.getByRole("button", { name: "Confirm booking" }).click();
  await expect(popup.getByTestId("booking-heading")).toHaveText("You're booked! 🎉");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".booked-overlay")).toHaveCount(0);

  // Button style: a normal link that opens the popup.
  await page.goto("/api/embed-preview?style=button&path=/demo");
  await page.getByRole("link", { name: "Book a call" }).click();
  await expect(page.frameLocator(".booked-panel iframe").getByRole("link", { name: /Owner intro call/ })).toBeVisible();

  // The admin area refuses to be framed.
  const res = await page.request.get("/admin");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("team owner invites a teammate who joins with a magic link", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByLabel("Your email").fill("demo@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const login = outbox().reverse().find((m) => m.subject.includes("sign-in link"));
  await page.goto(login.text.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/]+/, ""));
  await page.getByRole("button", { name: "Continue to my dashboard" }).click();

  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sunny Stays Team" })).toBeVisible();
  await page.getByLabel("Invite a teammate by email").fill("riley@example.com");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Invite sent to riley@example.com")).toBeVisible();

  // Share & embed shows a ready-to-paste snippet.
  await page.getByRole("link", { name: "Share & embed" }).click();
  await expect(page.getByTestId("embed-snippet")).toContainText('<script src="http://localhost:3100/embed.js" async></script>');

  const invite = outbox().reverse().find((m) => m.to === "riley@example.com");
  expect(invite.subject).toContain("invited you to join Sunny Stays Team");
  const mate = await browser.newPage();
  await mate.goto(invite.text.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/]+/, "http://localhost:3100"));
  await mate.getByRole("button", { name: "Accept & continue" }).click();
  await expect(mate.getByText("Welcome to the team!")).toBeVisible();
  // They have their own booking page.
  await mate.goto("/riley/quick-chat");
  await expect(mate.getByRole("heading", { name: "Quick chat" })).toBeVisible();
  await mate.close();
});
