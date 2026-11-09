/** Human-friendly date/time strings. Works in the browser and on the server (Intl only). */

export function formatDateTimeRange(start: number, end: number, timeZone: string, locale = "en-US"): string {
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(start);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone });
  return `${date} · ${time.format(start)} – ${time.format(end)}`;
}

export function formatTime(ms: number, timeZone: string, hour12 = true, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12, timeZone }).format(ms);
}

/** YYYY-MM-DD for an instant as seen in a timezone. */
export function dateKey(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function timeZoneLabel(timeZone: string): string {
  return timeZone.replace(/_/g, " ");
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
