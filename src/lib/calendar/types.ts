import type { Interval } from "../types";

export type CalendarEventInput = {
  title: string;
  description: string;
  location: string;
  start: number;
  end: number;
  timeZone: string;
  attendee: { name: string; email: string };
};

export type CalendarInfo = { id: string; name: string; primary: boolean };

/** Anything that can tell us when the owner is busy and hold new bookings. */
export interface CalendarProvider {
  busy(calendarIds: string[], from: number, to: number): Promise<Interval[]>;
  createEvent(calendarId: string, ev: CalendarEventInput): Promise<string>;
  updateEvent(calendarId: string, eventId: string, ev: CalendarEventInput): Promise<void>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  listCalendars(): Promise<CalendarInfo[]>;
}
