import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, fold, icsDate } from "@/lib/ics";

describe("ics", () => {
  const ics = buildIcs({
    uid: "abc@booked-lite",
    sequence: 2,
    start: Date.UTC(2026, 10, 10, 15, 0),
    end: Date.UTC(2026, 10, 10, 15, 30),
    title: "Owner intro call, with Sam; welcome",
    description: "Line one\nLine two",
    location: "https://meet.jit.si/OwnerIntro-abc",
    organizer: { name: "Sunny Stays", email: "host@example.com" },
    attendee: { name: 'Sam "The Guest"', email: "sam@example.com" },
    method: "REQUEST",
    now: Date.UTC(2026, 10, 9, 12, 0),
  });

  it("has the required structure", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("DTSTART:20261110T150000Z");
    expect(ics).toContain("DTEND:20261110T153000Z");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes text and strips quotes from names", () => {
    expect(ics).toContain("SUMMARY:Owner intro call\\, with Sam\; welcome");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
    expect(ics).toContain('ATTENDEE;CN="Sam The Guest"');
  });

  it("folds long lines at 75 bytes", () => {
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    const long = "DESCRIPTION:" + "é".repeat(80);
    expect(fold(long).split("\r\n ").join("")).toBe(long);
  });

  it("marks cancellations", () => {
    const c = buildIcs({ ...{ uid: "x", sequence: 3, start: 0, end: 1, title: "t", description: "", location: "", organizer: { name: "a", email: "a@x.com" }, attendee: { name: "b", email: "b@x.com" } }, method: "CANCEL" });
    expect(c).toContain("METHOD:CANCEL");
    expect(c).toContain("STATUS:CANCELLED");
  });

  it("helpers", () => {
    expect(icsDate(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe("20260102T030405Z");
    expect(escapeText("a\\b")).toBe("a\\\\b");
  });
});
