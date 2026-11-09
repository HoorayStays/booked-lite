import { DateTime } from "luxon";
import type { DateOverride, Interval, TimeRange, WeeklyHours } from "./types";

export type SlotRules = {
  /** Owner's IANA timezone, e.g. "America/Denver". Weekly hours are read in this zone. */
  timezone: string;
  weekly: WeeklyHours;
  overrides: DateOverride[];
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  slotStepMin: number;
  maxDaysAhead: number;
  /** Max bookings of this event type per day (owner's timezone). null = unlimited. */
  dailyLimit: number | null;
};

export type SlotQuery = {
  /** Everything that blocks time: calendar busy blocks + existing bookings. */
  busy: Interval[];
  /** Start times of confirmed bookings of THIS event type (used for the daily limit). */
  sameTypeBookingStarts: number[];
  rangeStart: number;
  rangeEnd: number;
  now: number;
};

const MIN = 60_000;

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) || t === "24:00";
}

function at(date: string, time: string, zone: string): DateTime {
  if (time === "24:00") return DateTime.fromISO(`${date}T00:00`, { zone }).plus({ days: 1 });
  return DateTime.fromISO(`${date}T${time}`, { zone });
}

/** The opening hours for one calendar date in the owner's timezone. */
export function rangesForDate(date: string, rules: Pick<SlotRules, "timezone" | "weekly" | "overrides">): TimeRange[] {
  const override = rules.overrides.find((o) => o.date === date);
  if (override) return override.ranges;
  const weekday = DateTime.fromISO(date, { zone: rules.timezone }).weekday % 7; // luxon: Mon=1..Sun=7 → Sun=0
  return rules.weekly[String(weekday) as keyof WeeklyHours] ?? [];
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Returns available start times (UTC epoch ms, sorted) for an event type.
 * Pure function: no database, no network. Covered by tests/slots.test.ts.
 */
export function computeSlots(rules: SlotRules, q: SlotQuery): number[] {
  const zone = rules.timezone;
  const duration = rules.durationMin * MIN;
  const step = Math.max(5, rules.slotStepMin) * MIN;
  const earliest = Math.max(q.rangeStart, q.now + rules.minNoticeMin * MIN);
  const lastDay = DateTime.fromMillis(q.now, { zone }).startOf("day").plus({ days: rules.maxDaysAhead }).endOf("day");
  const latest = Math.min(q.rangeEnd, lastDay.toMillis());
  if (latest <= earliest) return [];

  const busy = [...q.busy].sort((a, b) => a.start - b.start);
  const perDay = new Map<string, number>();
  for (const s of q.sameTypeBookingStarts) {
    const d = DateTime.fromMillis(s, { zone }).toISODate()!;
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const out = new Set<number>();
  let day = DateTime.fromMillis(earliest, { zone }).startOf("day");
  const stop = DateTime.fromMillis(latest, { zone }).startOf("day");
  while (day <= stop) {
    const date = day.toISODate()!;
    const limitReached = rules.dailyLimit != null && (perDay.get(date) ?? 0) >= rules.dailyLimit;
    if (!limitReached) {
      for (const r of rangesForDate(date, rules)) {
        if (!isValidTime(r.start) || !isValidTime(r.end)) continue;
        const open = at(date, r.start, zone).toMillis();
        const close = at(date, r.end, zone).toMillis();
        for (let t = open; t + duration <= close; t += step) {
          if (t < earliest || t > latest) continue;
          const blocked: Interval = {
            start: t - rules.bufferBeforeMin * MIN,
            end: t + duration + rules.bufferAfterMin * MIN,
          };
          if (!busy.some((b) => overlaps(b, blocked))) out.add(t);
        }
      }
    }
    day = day.plus({ days: 1 });
  }
  return [...out].sort((a, b) => a - b);
}

/** Merge overlapping intervals (keeps calendar queries tidy). */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Round robin = anyone free (union). Everyone-must-be-free / personal = all free (intersection). */
export function combineSlots(perHost: number[][], mode: "any" | "all"): number[] {
  if (perHost.length === 0) return [];
  if (mode === "any") return [...new Set(perHost.flat())].sort((a, b) => a - b);
  const [first, ...rest] = perHost;
  const sets = rest.map((s) => new Set(s));
  return first.filter((t) => sets.every((s) => s.has(t)));
}
