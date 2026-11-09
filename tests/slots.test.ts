import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { combineSlots, computeSlots, mergeIntervals, rangesForDate, type SlotRules } from "@/lib/slots";
import { DEFAULT_WEEKLY } from "@/lib/types";

const TZ = "America/Chicago";
const MIN = 60_000;
const local = (iso: string, zone = TZ) => DateTime.fromISO(iso, { zone }).toMillis();

const base: SlotRules = {
  timezone: TZ,
  weekly: DEFAULT_WEEKLY, // Mon–Fri 09:00–17:00
  overrides: [],
  durationMin: 30,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeMin: 0,
  slotStepMin: 30,
  maxDaysAhead: 60,
  dailyLimit: null,
};

// Monday 2026-11-09, 06:00 Chicago
const NOW = local("2026-11-09T06:00");
const dayRange = (date: string) => ({ rangeStart: local(`${date}T00:00`), rangeEnd: local(`${date}T23:59`) });
const q = (date: string, extra: Partial<Parameters<typeof computeSlots>[1]> = {}) => ({
  busy: [],
  sameTypeBookingStarts: [],
  now: NOW,
  ...dayRange(date),
  ...extra,
});
const fmt = (ms: number) => DateTime.fromMillis(ms, { zone: TZ }).toFormat("HH:mm");

describe("computeSlots", () => {
  it("offers every 30 minutes inside weekly hours", () => {
    const slots = computeSlots(base, q("2026-11-10"));
    expect(slots.map(fmt)).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
      "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    ]);
  });

  it("returns nothing on days off", () => {
    expect(computeSlots(base, q("2026-11-15"))).toEqual([]); // Sunday
  });

  it("removes busy times from the calendar", () => {
    const busy = [{ start: local("2026-11-10T10:00"), end: local("2026-11-10T11:15") }];
    const slots = computeSlots(base, q("2026-11-10", { busy })).map(fmt);
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
    expect(slots).not.toContain("11:00"); // 11:00–11:30 overlaps busy until 11:15
    expect(slots).toContain("09:30"); // ends exactly when busy starts
    expect(slots).toContain("11:30");
  });

  it("applies buffers before and after", () => {
    const busy = [{ start: local("2026-11-10T12:00"), end: local("2026-11-10T13:00") }];
    const slots = computeSlots({ ...base, bufferBeforeMin: 15, bufferAfterMin: 15 }, q("2026-11-10", { busy })).map(fmt);
    expect(slots).not.toContain("11:30"); // 11:30–12:00 + 15 min after → overlaps
    expect(slots).not.toContain("13:00"); // 15 min before → overlaps
    expect(slots).toContain("11:00");
    expect(slots).toContain("13:30");
  });

  it("respects minimum notice", () => {
    const now = local("2026-11-10T10:10");
    const slots = computeSlots({ ...base, minNoticeMin: 120 }, q("2026-11-10", { now })).map(fmt);
    expect(slots[0]).toBe("12:30");
  });

  it("enforces the daily limit for this event type", () => {
    const starts = [local("2026-11-10T09:00"), local("2026-11-10T15:00")];
    expect(computeSlots({ ...base, dailyLimit: 2 }, q("2026-11-10", { sameTypeBookingStarts: starts }))).toEqual([]);
    expect(computeSlots({ ...base, dailyLimit: 3 }, q("2026-11-10", { sameTypeBookingStarts: starts })).length).toBeGreaterThan(0);
  });

  it("uses date overrides (custom hours and days off)", () => {
    const overrides = [
      { date: "2026-11-10", ranges: [] },
      { date: "2026-11-15", ranges: [{ start: "10:00", end: "11:00" }] },
    ];
    expect(computeSlots({ ...base, overrides }, q("2026-11-10"))).toEqual([]);
    expect(computeSlots({ ...base, overrides }, q("2026-11-15")).map(fmt)).toEqual(["10:00", "10:30"]);
  });

  it("does not offer times beyond the booking window", () => {
    const r = { rangeStart: local("2026-11-09T00:00"), rangeEnd: local("2026-11-30T00:00") };
    const slots = computeSlots({ ...base, maxDaysAhead: 2 }, q("2026-11-09", r));
    const last = DateTime.fromMillis(slots[slots.length - 1], { zone: TZ });
    expect(last.toISODate()).toBe("2026-11-11");
  });

  it("handles daylight-saving changes (hours stay in local time)", () => {
    // US clocks go back on 2026-11-01. 09:00 Chicago is 14:00 UTC before, 15:00 UTC after.
    const before = computeSlots({ ...base, maxDaysAhead: 365 }, { ...q("2026-10-30"), now: local("2026-10-01T00:00") });
    const after = computeSlots({ ...base, maxDaysAhead: 365 }, { ...q("2026-11-02"), now: local("2026-10-01T00:00") });
    expect(new Date(before[0]).toISOString()).toBe("2026-10-30T14:00:00.000Z");
    expect(new Date(after[0]).toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });

  it("works for hosts in other timezones", () => {
    const rules = { ...base, timezone: "Europe/Lisbon" };
    const slots = computeSlots(rules, {
      ...q("2026-11-10"),
      rangeStart: local("2026-11-10T00:00", "Europe/Lisbon"),
      rangeEnd: local("2026-11-10T23:59", "Europe/Lisbon"),
    });
    expect(new Date(slots[0]).toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("supports a range ending at midnight", () => {
    const weekly = { ...DEFAULT_WEEKLY, "2": [{ start: "23:00", end: "24:00" }] };
    expect(computeSlots({ ...base, weekly }, q("2026-11-10")).map(fmt)).toEqual(["23:00", "23:30"]);
  });

  it("never duplicates slots from overlapping ranges", () => {
    const weekly = { ...DEFAULT_WEEKLY, "2": [{ start: "09:00", end: "10:00" }, { start: "09:00", end: "10:00" }] };
    expect(computeSlots({ ...base, weekly }, q("2026-11-10")).length).toBe(2);
  });

  it("ignores durations that don't fit", () => {
    expect(computeSlots({ ...base, durationMin: 600 }, q("2026-11-10"))).toEqual([]);
    expect(MIN).toBe(60000);
  });
});

describe("helpers", () => {
  it("rangesForDate reads the weekday in the host timezone", () => {
    expect(rangesForDate("2026-11-14", base)).toEqual([]); // Saturday
    expect(rangesForDate("2026-11-13", base)).toEqual([{ start: "09:00", end: "17:00" }]);
  });
  it("mergeIntervals joins overlaps", () => {
    expect(mergeIntervals([{ start: 5, end: 8 }, { start: 1, end: 3 }, { start: 2, end: 6 }])).toEqual([{ start: 1, end: 8 }]);
  });
});

describe("combineSlots (teams)", () => {
  it("round robin offers a time if anyone is free", () => {
    expect(combineSlots([[1, 3, 5], [2, 3]], "any")).toEqual([1, 2, 3, 5]);
  });
  it("everyone-must-be-free only offers shared times", () => {
    expect(combineSlots([[1, 3, 5], [2, 3, 5], [3, 5, 9]], "all")).toEqual([3, 5]);
  });
  it("no hosts means no times", () => {
    expect(combineSlots([], "any")).toEqual([]);
    expect(combineSlots([], "all")).toEqual([]);
  });
});
