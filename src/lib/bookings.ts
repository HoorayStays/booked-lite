import { and, eq, gt, gte, isNull, lt, lte, ne } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Booking, EventType, User } from "./db/schema";
import { computeSlots, mergeIntervals } from "./slots";
import { getCalendar, recordCalendarError } from "./calendar";
import type { CalendarEventInput } from "./calendar/types";
import { randomId, randomToken } from "./crypto";
import { resolveLocation, locationDisplay } from "./location";
import { buildIcs } from "./ics";
import { sendEmail } from "./email/send";
import { guestCancellation, guestConfirmation, guestReminder, manageUrl, ownerNotification } from "./email/templates";
import { DEFAULT_WEEKLY, type Interval } from "./types";
import { appUrl } from "./env";

const DAY = 86_400_000;

async function loadAvailability(userId: string) {
  const row = await getDb().query.availability.findFirst({ where: eq(schema.availability.userId, userId) });
  return row ?? { userId, weekly: DEFAULT_WEEKLY, overrides: [] };
}

/** Busy time from the owner's calendar. If the calendar can't be reached we still show slots and flag it in admin. */
async function calendarBusy(userId: string, from: number, to: number): Promise<Interval[]> {
  const cal = await getCalendar(userId);
  if (!cal) return [];
  try {
    return await cal.provider.busy(cal.conn.busyCalendarIds, from, to);
  } catch (err) {
    await recordCalendarError(userId, err);
    return [];
  }
}

export async function getAvailableSlots(
  owner: User,
  et: EventType,
  rangeStart: number,
  rangeEnd: number,
  opts: { ignoreBookingId?: string; now?: number } = {},
): Promise<number[]> {
  const now = opts.now ?? Date.now();
  const db = getDb();
  const pad = DAY; // look a little wider so buffers at the edges are respected
  const [avail, busy, existing] = await Promise.all([
    loadAvailability(owner.id),
    calendarBusy(owner.id, rangeStart - pad, rangeEnd + pad),
    db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.userId, owner.id),
          eq(schema.bookings.status, "confirmed"),
          lt(schema.bookings.startUtc, rangeEnd + pad),
          gt(schema.bookings.endUtc, rangeStart - pad),
        ),
      ),
  ]);
  const others = existing.filter((b) => b.id !== opts.ignoreBookingId);
  // A booking already written to Google shows up in both lists; merging makes that harmless.
  const allBusy = mergeIntervals([...busy, ...others.map((b) => ({ start: b.startUtc, end: b.endUtc }))]);
  return computeSlots(
    {
      timezone: owner.timezone,
      weekly: avail.weekly,
      overrides: avail.overrides,
      durationMin: et.durationMin,
      bufferBeforeMin: et.bufferBeforeMin,
      bufferAfterMin: et.bufferAfterMin,
      minNoticeMin: et.minNoticeMin,
      slotStepMin: et.slotStepMin,
      maxDaysAhead: et.maxDaysAhead,
      dailyLimit: et.dailyLimit,
    },
    {
      busy: allBusy,
      sameTypeBookingStarts: others.filter((b) => b.eventTypeId === et.id).map((b) => b.startUtc),
      rangeStart,
      rangeEnd,
      now,
    },
  );
}

async function isStillFree(owner: User, et: EventType, start: number, ignoreBookingId?: string) {
  const slots = await getAvailableSlots(owner, et, start - DAY, start + DAY, { ignoreBookingId });
  return slots.includes(start);
}

function calendarEvent(b: Booking, et: EventType, owner: User): CalendarEventInput {
  const where = locationDisplay(b.locationType, b.locationValue);
  const answers = et.questions
    .filter((q) => b.answers[q.id])
    .map((q) => `${q.label}: ${b.answers[q.id]}`)
    .join("\n");
  return {
    title: `${et.title} with ${b.guestName}`,
    description: [
      `Booked via B👀KED Lite`,
      `Guest: ${b.guestName} <${b.guestEmail}>`,
      `Where: ${where}`,
      answers,
      `Manage: ${appUrl()}/admin`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: where,
    start: b.startUtc,
    end: b.endUtc,
    timeZone: owner.timezone,
    attendee: { name: b.guestName, email: b.guestEmail },
  };
}

function inviteFor(b: Booking, et: EventType, owner: User, method: "REQUEST" | "CANCEL") {
  const where = locationDisplay(b.locationType, b.locationValue);
  return {
    filename: method === "CANCEL" ? "cancel.ics" : "invite.ics",
    contentType: `text/calendar; charset=utf-8; method=${method}`,
    content: buildIcs({
      uid: `${b.id}@booked-lite`,
      sequence: b.sequence,
      start: b.startUtc,
      end: b.endUtc,
      title: `${et.title} with ${owner.name || owner.username}`,
      description: `Where: ${where}\nReschedule or cancel: ${manageUrl(b)}`,
      location: where,
      url: manageUrl(b),
      organizer: { name: owner.name || owner.username, email: owner.email },
      attendee: { name: b.guestName, email: b.guestEmail },
      method,
    }),
  };
}

export type BookingRequest = {
  start: number;
  name: string;
  email: string;
  timezone: string;
  answers: Record<string, string>;
  guestPhone?: string;
};

export class BookingError extends Error {}

export async function createBooking(owner: User, et: EventType, req: BookingRequest): Promise<Booking> {
  if (!(await isStillFree(owner, et, req.start))) {
    throw new BookingError("Sorry, that time was just taken. Please pick another one.");
  }
  const db = getDb();
  const [booking] = await db
    .insert(schema.bookings)
    .values({
      id: randomId(20),
      userId: owner.id,
      eventTypeId: et.id,
      startUtc: req.start,
      endUtc: req.start + et.durationMin * 60_000,
      guestName: req.name,
      guestEmail: req.email,
      guestTimezone: req.timezone,
      answers: req.answers,
      locationType: et.locationType,
      locationValue: resolveLocation(et.locationType, et.locationValue, et.title, req.guestPhone),
      manageToken: randomToken(24),
    })
    .returning();

  const cal = await getCalendar(owner.id);
  if (cal) {
    try {
      const eventId = await cal.provider.createEvent(cal.conn.writeCalendarId, calendarEvent(booking, et, owner));
      await db.update(schema.bookings).set({ calendarEventId: eventId }).where(eq(schema.bookings.id, booking.id));
      booking.calendarEventId = eventId;
    } catch (err) {
      await recordCalendarError(owner.id, err);
    }
  }

  const ctx = { booking, eventType: et, owner };
  await Promise.all([
    sendEmail({ to: booking.guestEmail, ...guestConfirmation(ctx, "new"), attachments: [inviteFor(booking, et, owner, "REQUEST")] }),
    sendEmail({ to: owner.email, ...ownerNotification(ctx, "new") }),
  ]);
  return booking;
}

export async function rescheduleBooking(booking: Booking, et: EventType, owner: User, start: number): Promise<Booking> {
  if (booking.status !== "confirmed") throw new BookingError("This booking was cancelled.");
  if (!(await isStillFree(owner, et, start, booking.id))) {
    throw new BookingError("Sorry, that time was just taken. Please pick another one.");
  }
  const db = getDb();
  const [updated] = await db
    .update(schema.bookings)
    .set({
      startUtc: start,
      endUtc: start + et.durationMin * 60_000,
      sequence: booking.sequence + 1,
      reminderSentAt: null,
    })
    .where(eq(schema.bookings.id, booking.id))
    .returning();

  const cal = await getCalendar(owner.id);
  if (cal && updated.calendarEventId) {
    try {
      await cal.provider.updateEvent(cal.conn.writeCalendarId, updated.calendarEventId, calendarEvent(updated, et, owner));
    } catch (err) {
      await recordCalendarError(owner.id, err);
    }
  }
  const ctx = { booking: updated, eventType: et, owner };
  await Promise.all([
    sendEmail({ to: updated.guestEmail, ...guestConfirmation(ctx, "rescheduled"), attachments: [inviteFor(updated, et, owner, "REQUEST")] }),
    sendEmail({ to: owner.email, ...ownerNotification(ctx, "rescheduled") }),
  ]);
  return updated;
}

export async function cancelBooking(booking: Booking, by: "guest" | "owner", reason?: string): Promise<void> {
  if (booking.status === "cancelled") return;
  const db = getDb();
  const [updated] = await db
    .update(schema.bookings)
    .set({ status: "cancelled", cancelReason: reason || null, sequence: booking.sequence + 1 })
    .where(eq(schema.bookings.id, booking.id))
    .returning();
  const [et, owner] = await Promise.all([
    db.query.eventTypes.findFirst({ where: eq(schema.eventTypes.id, booking.eventTypeId) }),
    db.query.users.findFirst({ where: eq(schema.users.id, booking.userId) }),
  ]);
  if (!et || !owner) return;

  const cal = await getCalendar(owner.id);
  if (cal && updated.calendarEventId) {
    try {
      await cal.provider.deleteEvent(cal.conn.writeCalendarId, updated.calendarEventId);
    } catch (err) {
      await recordCalendarError(owner.id, err);
    }
  }
  const ctx = { booking: updated, eventType: et, owner };
  await Promise.all([
    sendEmail({ to: updated.guestEmail, ...guestCancellation(ctx, by, reason), attachments: [inviteFor(updated, et, owner, "CANCEL")] }),
    by === "guest" ? sendEmail({ to: owner.email, ...ownerNotification(ctx, "cancelled", reason) }) : Promise.resolve(),
  ]);
}

/**
 * Sends a reminder for confirmed bookings starting within `hoursAhead` hours.
 * Safe to run as often as you like: each booking is reminded once.
 */
export async function sendDueReminders(now = Date.now(), hoursAhead = Number(process.env.REMINDER_HOURS || 24)) {
  const db = getDb();
  const due = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.status, "confirmed"),
        isNull(schema.bookings.reminderSentAt),
        gte(schema.bookings.startUtc, now),
        lte(schema.bookings.startUtc, now + hoursAhead * 3_600_000),
        // Don't remind someone who booked in the last hour: they just got the confirmation.
        lte(schema.bookings.createdAt, now - 3_600_000),
      ),
    );
  let sent = 0;
  for (const b of due) {
    const [et, owner] = await Promise.all([
      db.query.eventTypes.findFirst({ where: eq(schema.eventTypes.id, b.eventTypeId) }),
      db.query.users.findFirst({ where: eq(schema.users.id, b.userId) }),
    ]);
    if (!et || !owner) continue;
    const res = await sendEmail({ to: b.guestEmail, ...guestReminder({ booking: b, eventType: et, owner }) });
    if (res.ok) {
      await db.update(schema.bookings).set({ reminderSentAt: now }).where(eq(schema.bookings.id, b.id));
      sent++;
    }
  }
  return { checked: due.length, sent };
}

export async function getBookingWithContext(id: string) {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
  if (!booking) return null;
  const [et, owner] = await Promise.all([
    db.query.eventTypes.findFirst({ where: eq(schema.eventTypes.id, booking.eventTypeId) }),
    db.query.users.findFirst({ where: eq(schema.users.id, booking.userId) }),
  ]);
  if (!et || !owner) return null;
  return { booking, eventType: et, owner };
}

export async function listBookings(userId: string, when: "upcoming" | "past") {
  const db = getDb();
  const now = Date.now();
  const rows = await db
    .select({ booking: schema.bookings, eventTitle: schema.eventTypes.title, questions: schema.eventTypes.questions })
    .from(schema.bookings)
    .innerJoin(schema.eventTypes, eq(schema.eventTypes.id, schema.bookings.eventTypeId))
    .where(
      and(
        eq(schema.bookings.userId, userId),
        when === "upcoming" ? gte(schema.bookings.endUtc, now) : lt(schema.bookings.endUtc, now),
        when === "upcoming" ? ne(schema.bookings.status, "cancelled") : undefined,
      ),
    )
    .orderBy(schema.bookings.startUtc)
    .limit(200);
  return when === "past" ? rows.reverse() : rows;
}
