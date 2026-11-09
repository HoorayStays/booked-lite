import { and, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Booking, EventType, User } from "./db/schema";
import { combineSlots, computeSlots, mergeIntervals } from "./slots";
import { getCalendar, recordCalendarError } from "./calendar";
import type { CalendarEventInput } from "./calendar/types";
import { randomId, randomToken } from "./crypto";
import { jitsiRoomUrl, resolveLocation } from "./location";
import { buildIcs } from "./ics";
import { sendEmail } from "./email/send";
import {
  displayName,
  guestCancellation,
  guestConfirmation,
  guestReminder,
  hostLabel,
  hostNotification,
  manageUrl,
  whereText,
  type BookingCtx,
} from "./email/templates";
import { getEventHosts } from "./teams";
import { getZoom, recordZoomError, type ZoomMeetingInput } from "./zoom";
import { DEFAULT_WEEKLY, type Interval } from "./types";
import { appUrl } from "./env";

const DAY = 86_400_000;

export class BookingError extends Error {}

/* ---------------------------------------------------------------- slots */

async function loadAvailability(userId: string) {
  const row = await getDb().query.availability.findFirst({ where: eq(schema.availability.userId, userId) });
  return row ?? { userId, weekly: DEFAULT_WEEKLY, overrides: [] };
}

/** Busy time from the host's calendar. If it can't be reached we still show slots and flag it in admin. */
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

/** Confirmed bookings a person is hosting in a time range. */
async function hostBookings(userId: string, from: number, to: number) {
  return getDb()
    .select({ id: schema.bookings.id, start: schema.bookings.startUtc, end: schema.bookings.endUtc })
    .from(schema.bookings)
    .innerJoin(schema.bookingHosts, eq(schema.bookingHosts.bookingId, schema.bookings.id))
    .where(
      and(
        eq(schema.bookingHosts.userId, userId),
        eq(schema.bookings.status, "confirmed"),
        lt(schema.bookings.startUtc, to),
        gt(schema.bookings.endUtc, from),
      ),
    );
}

type SlotOpts = { ignoreBookingId?: string; now?: number };

/** Open start times for ONE host for this event type. */
async function hostSlots(host: User, et: EventType, rangeStart: number, rangeEnd: number, opts: SlotOpts) {
  const now = opts.now ?? Date.now();
  const pad = DAY; // look a little wider so buffers at the edges are respected
  const [avail, busy, mine, sameType] = await Promise.all([
    loadAvailability(host.id),
    calendarBusy(host.id, rangeStart - pad, rangeEnd + pad),
    hostBookings(host.id, rangeStart - pad, rangeEnd + pad),
    getDb()
      .select({ id: schema.bookings.id, start: schema.bookings.startUtc })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.eventTypeId, et.id),
          eq(schema.bookings.status, "confirmed"),
          lt(schema.bookings.startUtc, rangeEnd + pad),
          gt(schema.bookings.endUtc, rangeStart - pad),
        ),
      ),
  ]);
  const others = mine.filter((b) => b.id !== opts.ignoreBookingId);
  // A booking already written to Google shows up in both lists; merging makes that harmless.
  const allBusy = mergeIntervals([...busy, ...others.map((b) => ({ start: b.start, end: b.end }))]);
  return computeSlots(
    {
      timezone: host.timezone,
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
      // The daily limit counts all bookings of this event type, whoever hosts them (in this host's timezone).
      sameTypeBookingStarts: sameType.filter((b) => b.id !== opts.ignoreBookingId).map((b) => b.start),
      rangeStart,
      rangeEnd,
      now,
    },
  );
}

function modeFor(et: EventType): "any" | "all" {
  return et.teamId && et.schedulingType !== "collective" ? "any" : "all";
}

async function usersById(ids: string[]) {
  if (!ids.length) return [];
  return getDb().select().from(schema.users).where(inArray(schema.users.id, ids));
}

async function bookingHostIds(bookingId: string) {
  const rows = await getDb()
    .select({ userId: schema.bookingHosts.userId })
    .from(schema.bookingHosts)
    .where(eq(schema.bookingHosts.bookingId, bookingId));
  return rows.map((r) => r.userId);
}

/**
 * Available start times for an event type.
 * When rescheduling (`ignoreBookingId`), the booking keeps its host(s), so only their time counts.
 */
export async function getAvailableSlots(et: EventType, rangeStart: number, rangeEnd: number, opts: SlotOpts = {}) {
  const fixed = opts.ignoreBookingId ? await bookingHostIds(opts.ignoreBookingId) : [];
  const hosts = fixed.length ? await usersById(fixed) : await getEventHosts(et);
  const perHost = await Promise.all(hosts.map((h) => hostSlots(h, et, rangeStart, rangeEnd, opts)));
  return combineSlots(perHost, fixed.length ? "all" : modeFor(et));
}

/** Who will host a booking at `start`, or null if nobody suitable is free any more. */
async function pickHosts(et: EventType, start: number): Promise<User[] | null> {
  const hosts = await getEventHosts(et);
  const free: User[] = [];
  for (const h of hosts) {
    const slots = await hostSlots(h, et, start - DAY, start + DAY, {});
    if (slots.includes(start)) free.push(h);
  }
  if (modeFor(et) === "all") {
    if (free.length !== hosts.length || hosts.length === 0) return null;
    // The event owner leads (their Zoom / Google Meet is used) when they're one of the hosts.
    return [...free].sort((a, b) => (a.id === et.userId ? -1 : b.id === et.userId ? 1 : 0));
  }
  if (free.length === 0) return null;
  // Round robin: whoever got a booking of this type least recently (or never) goes next.
  const recent = await getDb()
    .select({ userId: schema.bookingHosts.userId, createdAt: schema.bookings.createdAt })
    .from(schema.bookingHosts)
    .innerJoin(schema.bookings, eq(schema.bookings.id, schema.bookingHosts.bookingId))
    .where(eq(schema.bookings.eventTypeId, et.id))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(500);
  const last = new Map<string, number>();
  for (const r of recent) if (!last.has(r.userId)) last.set(r.userId, r.createdAt);
  const next = [...free].sort((a, b) => (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0))[0];
  return [next];
}

/* -------------------------------------------------------------- context */

export async function getBookingWithContext(id: string): Promise<BookingCtx | null> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
  if (!booking) return null;
  const eventType = await db.query.eventTypes.findFirst({ where: eq(schema.eventTypes.id, booking.eventTypeId) });
  if (!eventType) return null;
  const [owner, hostIds, team] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, eventType.userId) }),
    bookingHostIds(booking.id),
    eventType.teamId ? db.query.teams.findFirst({ where: eq(schema.teams.id, eventType.teamId) }) : null,
  ]);
  if (!owner) return null;
  const users = await usersById(hostIds.length ? hostIds : [booking.userId]);
  // Lead host (booking.userId) first.
  const hosts = users.sort((a, b) => (a.id === booking.userId ? -1 : b.id === booking.userId ? 1 : 0));
  return { booking, eventType, owner, hosts, team: team ?? null };
}

function calendarEvent(ctx: BookingCtx, host: User): CalendarEventInput {
  const { booking: b, eventType: et } = ctx;
  const answers = et.questions
    .filter((q) => b.answers[q.id])
    .map((q) => `${q.label}: ${b.answers[q.id]}`)
    .join("\n");
  return {
    title: `${et.title} with ${b.guestName}`,
    description: [
      `Booked via B👀KED Lite`,
      `Guest: ${b.guestName} <${b.guestEmail}>`,
      ctx.hosts.length > 1 ? `Hosts: ${ctx.hosts.map(displayName).join(", ")}` : "",
      b.locationValue ? `Where: ${whereText(b)}` : "",
      answers,
      `Manage: ${appUrl()}/admin`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: whereText(b),
    start: b.startUtc,
    end: b.endUtc,
    timeZone: host.timezone,
    attendee: { name: b.guestName, email: b.guestEmail },
  };
}

function zoomInput(ctx: BookingCtx): ZoomMeetingInput {
  const { booking: b, eventType: et } = ctx;
  return {
    topic: `${et.title} with ${b.guestName}`,
    start: b.startUtc,
    durationMin: Math.round((b.endUtc - b.startUtc) / 60_000),
    timeZone: ctx.hosts[0]?.timezone ?? "UTC",
    agenda: `Booked via B👀KED Lite. Guest: ${b.guestName} <${b.guestEmail}>`,
  };
}

function inviteFor(ctx: BookingCtx, method: "REQUEST" | "CANCEL") {
  const { booking: b, eventType: et } = ctx;
  const lead = ctx.hosts[0] ?? ctx.owner;
  const where = whereText(b);
  return {
    filename: method === "CANCEL" ? "cancel.ics" : "invite.ics",
    contentType: `text/calendar; charset=utf-8; method=${method}`,
    content: buildIcs({
      uid: `${b.id}@booked-lite`,
      sequence: b.sequence,
      start: b.startUtc,
      end: b.endUtc,
      title: `${et.title} with ${hostLabel(ctx)}`,
      description: `Where: ${where}\nReschedule or cancel: ${manageUrl(b)}`,
      location: where,
      url: manageUrl(b),
      organizer: { name: displayName(lead), email: lead.email },
      attendee: { name: b.guestName, email: b.guestEmail },
      method,
    }),
  };
}

export function bookingIcs(ctx: BookingCtx) {
  return inviteFor(ctx, ctx.booking.status === "cancelled" ? "CANCEL" : "REQUEST").content;
}

async function notifyHosts(ctx: BookingCtx, kind: "new" | "rescheduled" | "cancelled", reason?: string) {
  await Promise.all(ctx.hosts.map((h) => sendEmail({ to: h.email, ...hostNotification(ctx, h, kind, reason) })));
}

/* ------------------------------------------------------------ mutations */

export type BookingRequest = {
  start: number;
  name: string;
  email: string;
  timezone: string;
  answers: Record<string, string>;
  guestPhone?: string;
};

export async function createBooking(et: EventType, req: BookingRequest): Promise<Booking> {
  const hosts = await pickHosts(et, req.start);
  if (!hosts) throw new BookingError("Sorry, that time was just taken. Please pick another one.");
  const lead = hosts[0];
  const db = getDb();
  let [booking] = await db
    .insert(schema.bookings)
    .values({
      id: randomId(20),
      userId: lead.id,
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
  await db.insert(schema.bookingHosts).values(hosts.map((h) => ({ bookingId: booking.id, userId: h.id })));

  const owner = et.userId === lead.id ? lead : (await db.query.users.findFirst({ where: eq(schema.users.id, et.userId) }))!;
  const team = et.teamId ? ((await db.query.teams.findFirst({ where: eq(schema.teams.id, et.teamId) })) ?? null) : null;
  const ctx: BookingCtx = { booking, eventType: et, owner, hosts, team };
  const patch: Partial<Booking> = {};

  // 1. Zoom: a fresh meeting in the lead host's Zoom account.
  if (et.locationType === "zoom") {
    const zoom = await getZoom(lead.id);
    if (zoom) {
      try {
        const m = await zoom.createMeeting(zoomInput(ctx));
        Object.assign(patch, { locationValue: m.joinUrl, meetingId: m.id, meetingPassword: m.password || null });
      } catch (err) {
        await recordZoomError(lead.id, err);
      }
    }
  }
  // Google Meet links come from the lead host's calendar event (step 2).
  const wantsMeet = et.locationType === "google_meet";
  Object.assign(booking, patch);

  // 2. Calendar events: lead host first (creates the Meet link if needed), then everyone else.
  const calendarIds = new Map<string, string>();
  for (const host of hosts) {
    const cal = await getCalendar(host.id);
    if (!cal) continue;
    try {
      const created = await cal.provider.createEvent(cal.conn.writeCalendarId, {
        ...calendarEvent(ctx, host),
        withMeet: wantsMeet && host.id === lead.id && !booking.locationValue,
      });
      calendarIds.set(host.id, created.id);
      if (created.meetUrl && !booking.locationValue) {
        booking.locationValue = patch.locationValue = created.meetUrl;
      }
    } catch (err) {
      await recordCalendarError(host.id, err);
    }
  }

  // 3. If Zoom / Meet couldn't be created (not connected, or an error), fall back to a free Jitsi room.
  if ((et.locationType === "zoom" || et.locationType === "google_meet") && !booking.locationValue) {
    Object.assign(patch, { locationType: "jitsi", locationValue: jitsiRoomUrl(et.title) });
    Object.assign(booking, patch);
    for (const host of hosts) {
      const id = calendarIds.get(host.id);
      const cal = id ? await getCalendar(host.id) : null;
      if (cal && id) await cal.provider.updateEvent(cal.conn.writeCalendarId, id, calendarEvent(ctx, host)).catch(() => {});
    }
  }

  if (Object.keys(patch).length) {
    [booking] = await db.update(schema.bookings).set(patch).where(eq(schema.bookings.id, booking.id)).returning();
    ctx.booking = booking;
  }
  for (const [userId, calendarEventId] of calendarIds) {
    await db
      .update(schema.bookingHosts)
      .set({ calendarEventId })
      .where(and(eq(schema.bookingHosts.bookingId, booking.id), eq(schema.bookingHosts.userId, userId)));
  }

  await Promise.all([
    sendEmail({ to: booking.guestEmail, ...guestConfirmation(ctx, "new"), attachments: [inviteFor(ctx, "REQUEST")] }),
    notifyHosts(ctx, "new"),
  ]);
  return booking;
}

async function hostRows(bookingId: string) {
  return getDb().select().from(schema.bookingHosts).where(eq(schema.bookingHosts.bookingId, bookingId));
}

export async function rescheduleBooking(ctx: BookingCtx, start: number): Promise<Booking> {
  const { booking, eventType: et } = ctx;
  if (booking.status !== "confirmed") throw new BookingError("This booking was cancelled.");
  const slots = await getAvailableSlots(et, start - DAY, start + DAY, { ignoreBookingId: booking.id });
  if (!slots.includes(start)) throw new BookingError("Sorry, that time was just taken. Please pick another one.");
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
  const next: BookingCtx = { ...ctx, booking: updated };

  if (updated.meetingId) {
    const zoom = await getZoom(updated.userId);
    if (zoom) await zoom.updateMeeting(updated.meetingId, zoomInput(next)).catch((e) => recordZoomError(updated.userId, e));
  }
  for (const row of await hostRows(updated.id)) {
    const host = ctx.hosts.find((h) => h.id === row.userId);
    const cal = row.calendarEventId && host ? await getCalendar(host.id) : null;
    if (!cal || !host) continue;
    try {
      await cal.provider.updateEvent(cal.conn.writeCalendarId, row.calendarEventId!, calendarEvent(next, host));
    } catch (err) {
      await recordCalendarError(host.id, err);
    }
  }
  await Promise.all([
    sendEmail({ to: updated.guestEmail, ...guestConfirmation(next, "rescheduled"), attachments: [inviteFor(next, "REQUEST")] }),
    notifyHosts(next, "rescheduled"),
  ]);
  return updated;
}

export async function cancelBooking(bookingId: string, by: "guest" | "owner", reason?: string): Promise<void> {
  const ctx = await getBookingWithContext(bookingId);
  if (!ctx || ctx.booking.status === "cancelled") return;
  const db = getDb();
  const [updated] = await db
    .update(schema.bookings)
    .set({ status: "cancelled", cancelReason: reason || null, sequence: ctx.booking.sequence + 1 })
    .where(eq(schema.bookings.id, bookingId))
    .returning();
  const next: BookingCtx = { ...ctx, booking: updated };

  if (updated.meetingId) {
    const zoom = await getZoom(updated.userId);
    if (zoom) await zoom.deleteMeeting(updated.meetingId).catch((e) => recordZoomError(updated.userId, e));
  }
  for (const row of await hostRows(updated.id)) {
    const cal = row.calendarEventId ? await getCalendar(row.userId) : null;
    if (!cal) continue;
    try {
      await cal.provider.deleteEvent(cal.conn.writeCalendarId, row.calendarEventId!);
    } catch (err) {
      await recordCalendarError(row.userId, err);
    }
  }
  await Promise.all([
    sendEmail({ to: updated.guestEmail, ...guestCancellation(next, by, reason), attachments: [inviteFor(next, "CANCEL")] }),
    notifyHosts(next, "cancelled", reason),
  ]);
}

/**
 * Sends a reminder for confirmed bookings starting within `hoursAhead` hours.
 * Safe to run as often as you like: each booking is reminded once.
 */
export async function sendDueReminders(now = Date.now(), hoursAhead = Number(process.env.REMINDER_HOURS || 24)) {
  const db = getDb();
  const due = await db
    .select({ id: schema.bookings.id })
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
  for (const { id } of due) {
    const ctx = await getBookingWithContext(id);
    if (!ctx) continue;
    const res = await sendEmail({ to: ctx.booking.guestEmail, ...guestReminder(ctx) });
    if (res.ok) {
      await db.update(schema.bookings).set({ reminderSentAt: now }).where(eq(schema.bookings.id, id));
      sent++;
    }
  }
  return { checked: due.length, sent };
}

/** Bookings a person hosts, plus bookings of event types they own (e.g. a team owner's round-robin events). */
export async function listBookings(userId: string, when: "upcoming" | "past") {
  const db = getDb();
  const now = Date.now();
  const hosted = db.select({ id: schema.bookingHosts.bookingId }).from(schema.bookingHosts).where(eq(schema.bookingHosts.userId, userId));
  const rows = await db
    .select({ booking: schema.bookings, eventTitle: schema.eventTypes.title, questions: schema.eventTypes.questions })
    .from(schema.bookings)
    .innerJoin(schema.eventTypes, eq(schema.eventTypes.id, schema.bookings.eventTypeId))
    .where(
      and(
        or(inArray(schema.bookings.id, hosted), eq(schema.eventTypes.userId, userId)),
        when === "upcoming" ? gte(schema.bookings.endUtc, now) : lt(schema.bookings.endUtc, now),
        when === "upcoming" ? ne(schema.bookings.status, "cancelled") : undefined,
      ),
    )
    .orderBy(schema.bookings.startUtc)
    .limit(200);
  const ids = rows.map((r) => r.booking.id);
  const hostNames = new Map<string, string[]>();
  if (ids.length) {
    const hr = await db
      .select({ bookingId: schema.bookingHosts.bookingId, name: schema.users.name, username: schema.users.username })
      .from(schema.bookingHosts)
      .innerJoin(schema.users, eq(schema.users.id, schema.bookingHosts.userId))
      .where(inArray(schema.bookingHosts.bookingId, ids));
    for (const h of hr) hostNames.set(h.bookingId, [...(hostNames.get(h.bookingId) ?? []), h.name || h.username]);
  }
  const out = rows.map((r) => ({ ...r, hosts: hostNames.get(r.booking.id) ?? [] }));
  return when === "past" ? out.reverse() : out;
}

/** Can this signed-in person manage (cancel) this booking? */
export async function canManageBooking(userId: string, bookingId: string) {
  const ctx = await getBookingWithContext(bookingId);
  if (!ctx) return null;
  return ctx.hosts.some((h) => h.id === userId) || ctx.eventType.userId === userId ? ctx : null;
}
