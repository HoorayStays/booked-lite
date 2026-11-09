/**
 * A pretend calendar stored in a JSON file. Used by the automated tests (and handy
 * for trying the app locally before Google is set up). Turn on with CALENDAR_PROVIDER=fake.
 */
import fs from "node:fs";
import path from "node:path";
import type { CalendarProvider, CalendarEventInput } from "./types";
import type { Interval } from "../types";

type FakeEvent = CalendarEventInput & { id: string; calendarId: string; userId: string };
/** `busy` blocks apply to everyone (or only `userId` when set); `events` are bookings written by the app. */
type FakeFile = { busy: { start: string; end: string; userId?: string }[]; events: FakeEvent[] };

export function fakeCalendarPath(): string {
  return process.env.FAKE_CALENDAR_FILE || path.join(process.cwd(), ".data", "fake-calendar.json");
}

export function readFake(): FakeFile {
  try {
    return JSON.parse(fs.readFileSync(fakeCalendarPath(), "utf8")) as FakeFile;
  } catch {
    return { busy: [], events: [] };
  }
}

function writeFake(data: FakeFile) {
  fs.mkdirSync(path.dirname(fakeCalendarPath()), { recursive: true });
  fs.writeFileSync(fakeCalendarPath(), JSON.stringify(data, null, 2));
}

export const fakeCalendar = (userId: string): CalendarProvider => ({
  async busy(_ids, from, to) {
    const data = readFake();
    const blocks: Interval[] = [
      ...data.busy.filter((b) => !b.userId || b.userId === userId).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
      ...data.events.filter((e) => e.userId === userId).map((e) => ({ start: e.start, end: e.end })),
    ];
    return blocks.filter((b) => b.start < to && b.end > from);
  },
  async createEvent(calendarId, ev) {
    const data = readFake();
    const id = `fake_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const meetUrl = ev.withMeet ? `https://meet.google.com/fak-${id.slice(-4)}-test` : undefined;
    data.events.push({ ...ev, id, calendarId, userId, ...(meetUrl ? { location: meetUrl } : {}) });
    writeFake(data);
    return { id, meetUrl };
  },
  async updateEvent(_calendarId, eventId, ev) {
    const data = readFake();
    data.events = data.events.map((e) => (e.id === eventId ? { ...e, ...ev } : e));
    writeFake(data);
  },
  async deleteEvent(_calendarId, eventId) {
    const data = readFake();
    data.events = data.events.filter((e) => e.id !== eventId);
    writeFake(data);
  },
  async listCalendars() {
    return [
      { id: "primary", name: "Test calendar", primary: true },
      { id: "airbnb", name: "Airbnb sync (test)", primary: false },
    ];
  },
});
