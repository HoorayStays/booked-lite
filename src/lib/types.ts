/** "HH:MM" in 24h time, in the owner's timezone. */
export type TimeRange = { start: string; end: string };

/** 0 = Sunday … 6 = Saturday (same as JavaScript's Date#getDay). */
export type WeeklyHours = Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", TimeRange[]>;

/** A specific date (YYYY-MM-DD, owner's timezone). Empty `ranges` = day off. */
export type DateOverride = { date: string; ranges: TimeRange[] };

export type Question = {
  id: string;
  label: string;
  type: "text" | "textarea" | "phone";
  required: boolean;
};

export type LocationType = "jitsi" | "link" | "phone" | "in_person" | "zoom" | "google_meet";

/** Team events: next available person, or everyone must be free. */
export type SchedulingType = "round_robin" | "collective";

/** A busy block, epoch milliseconds UTC, end exclusive. */
export type Interval = { start: number; end: number };

export const DEFAULT_WEEKLY: WeeklyHours = {
  "0": [],
  "1": [{ start: "09:00", end: "17:00" }],
  "2": [{ start: "09:00", end: "17:00" }],
  "3": [{ start: "09:00", end: "17:00" }],
  "4": [{ start: "09:00", end: "17:00" }],
  "5": [{ start: "09:00", end: "17:00" }],
  "6": [],
};
