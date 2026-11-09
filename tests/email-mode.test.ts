import { afterEach, describe, expect, it, vi } from "vitest";
import { guestEmailMode } from "@/lib/env";
import { forwardToGuest } from "@/lib/email/templates";

afterEach(() => vi.unstubAllEnvs());

describe("guest email mode (no domain yet → forward to host)", () => {
  it("logs when Resend isn't set up", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(guestEmailMode()).toBe("log");
  });
  it("forwards to the host until a verified domain is used", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "");
    expect(guestEmailMode()).toBe("forward-to-host");
    vi.stubEnv("EMAIL_FROM", "Bookings <onboarding@resend.dev>");
    expect(guestEmailMode()).toBe("forward-to-host");
  });
  it("emails guests directly from a verified domain", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Sunny Stays <bookings@sunnystays.com>");
    expect(guestEmailMode()).toBe("send");
  });
});

describe("forwardToGuest", () => {
  const original = {
    subject: "Confirmed: Intro call with Alex",
    html: '<html><body><div style="max-width:560px;margin:0 auto;padding:24px 16px"><h1>Hi</h1></div></body></html>',
    text: "You're booked!",
    attachments: [{ filename: "invite.ics", content: "BEGIN:VCALENDAR", contentType: "text/calendar" }],
  };
  const fwd = forwardToGuest(original, "Sam <Guest>", "sam@example.com");

  it("asks the host to forward it, keeping the invite attached", () => {
    expect(fwd.subject).toBe("[Forward to Sam <Guest>] Confirmed: Intro call with Alex");
    expect(fwd.text).toMatch(/^📨 FORWARD TO YOUR GUEST: .*sam@example\.com/);
    expect(fwd.text).toContain("You're booked!");
    expect(fwd.attachments).toEqual(original.attachments);
    expect(fwd.replyTo).toBe("sam@example.com");
  });
  it("puts an escaped banner at the top of the HTML", () => {
    expect(fwd.html).toContain("Forward to your guest.");
    expect(fwd.html).toContain("Sam &lt;Guest&gt;");
    expect(fwd.html.indexOf("Forward to your guest")).toBeLessThan(fwd.html.indexOf("<h1>Hi</h1>"));
  });
});
