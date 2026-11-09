"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { canManageBooking, cancelBooking } from "@/lib/bookings";
import { createTeam, getMembership, inviteToTeam, removeMember, renameTeam, setEventHosts } from "@/lib/teams";
import { randomId } from "@/lib/crypto";
import { isValidTimeZone } from "@/lib/format";
import { isHexColor } from "@/lib/brand";
import { isValidTime } from "@/lib/slots";
import { isUrl } from "@/lib/location";
import { RESERVED_USERNAMES, slugify } from "@/lib/users";
import { getCalendar } from "@/lib/calendar";
import type { DateOverride, Question, WeeklyHours } from "@/lib/types";

export type ActionState = { ok?: boolean; error?: string; message?: string };

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

/* ---------------- bookings ---------------- */

export async function cancelAsOwner(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (await canManageBooking(user.id, id)) {
    await cancelBooking(id, "owner", String(formData.get("reason") ?? "").trim().slice(0, 500) || undefined);
  }
  revalidatePath("/admin");
}

/* ---------------- event types ---------------- */

export async function createEventType() {
  const user = await requireUser();
  const db = getDb();
  const id = randomId(20);
  const existing = await db.select({ slug: schema.eventTypes.slug }).from(schema.eventTypes).where(eq(schema.eventTypes.userId, user.id));
  let slug = "new-event";
  for (let i = 2; existing.some((e) => e.slug === slug); i++) slug = `new-event-${i}`;
  await db.insert(schema.eventTypes).values({
    id,
    userId: user.id,
    slug,
    title: "New event",
    questions: [],
    active: false,
    position: existing.length,
  });
  redirect(`/admin/events/${id}`);
}

const QuestionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(200),
  type: z.enum(["text", "textarea", "phone"]),
  required: z.boolean(),
});

const EventSchema = z.object({
  title: z.string().trim().min(1, "Give your event a title").max(120),
  slug: z.string().trim().max(60),
  description: z.string().max(2000),
  durationMin: int(5, 600),
  bufferBeforeMin: int(0, 240),
  bufferAfterMin: int(0, 240),
  minNoticeHours: z.coerce.number().min(0).max(24 * 60),
  dailyLimit: z.string().optional(),
  slotStepMin: int(5, 240),
  maxDaysAhead: int(1, 365),
  locationType: z.enum(["jitsi", "link", "phone", "in_person", "zoom", "google_meet"]),
  hostMode: z.enum(["me", "round_robin", "collective"]).default("me"),
  locationValue: z.string().trim().max(500),
  questions: z.string(),
  active: z.string().optional(),
});

export async function saveEventType(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = EventSchema.safeParse({ ...Object.fromEntries(formData), hosts: undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const v = parsed.data;
  const slug = slugify(v.slug || v.title);
  if (!slug) return { error: "The link name needs at least one letter or number." };
  if (v.locationType === "link" && !isUrl(v.locationValue)) {
    return { error: "Paste the full meeting link, starting with https://" };
  }
  let questions: Question[];
  try {
    questions = z.array(QuestionSchema).max(10).parse(JSON.parse(v.questions));
  } catch {
    return { error: "Please give every question a label." };
  }
  const db = getDb();
  const clash = await db.query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.userId, user.id), eq(schema.eventTypes.slug, slug), ne(schema.eventTypes.id, id)),
  });
  if (clash) return { error: `You already have an event at /${slug}. Pick another link name.` };
  const limit = v.dailyLimit ? Number(v.dailyLimit) : null;

  // Team events: only the team owner can create them, and they need at least one host.
  let teamId: string | null = null;
  let hostIds: string[] = [];
  if (v.hostMode !== "me") {
    const membership = await getMembership(user.id);
    if (membership?.role !== "owner") return { error: "Only the team owner can create team events." };
    teamId = membership.team.id;
    hostIds = formData.getAll("hosts").map(String);
    if (hostIds.length === 0) return { error: "Pick at least one teammate to host this event." };
  }
  await db
    .update(schema.eventTypes)
    .set({
      title: v.title,
      slug,
      description: v.description,
      durationMin: v.durationMin,
      bufferBeforeMin: v.bufferBeforeMin,
      bufferAfterMin: v.bufferAfterMin,
      minNoticeMin: Math.round(v.minNoticeHours * 60),
      dailyLimit: limit && limit > 0 ? Math.floor(limit) : null,
      slotStepMin: v.slotStepMin,
      maxDaysAhead: v.maxDaysAhead,
      locationType: v.locationType,
      locationValue: v.locationValue,
      questions,
      active: v.active === "on",
      teamId,
      schedulingType: v.hostMode === "me" ? null : v.hostMode,
    })
    .where(and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.userId, user.id)));
  if (teamId) await setEventHosts(id, teamId, hostIds);
  else await db.delete(schema.eventTypeHosts).where(eq(schema.eventTypeHosts.eventTypeId, id));
  revalidatePath("/admin/events");
  return { ok: true, message: "Saved ✓" };
}

export async function deleteEventType(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await getDb().delete(schema.eventTypes).where(and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.userId, user.id)));
  redirect("/admin/events");
}

export async function toggleEventType(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const et = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.userId, user.id)),
  });
  if (et) await getDb().update(schema.eventTypes).set({ active: !et.active }).where(eq(schema.eventTypes.id, id));
  revalidatePath("/admin/events");
}

/* ---------------- availability ---------------- */

const Range = z.object({ start: z.string(), end: z.string() }).refine((r) => isValidTime(r.start) && isValidTime(r.end) && r.start < r.end, {
  message: "Each time range must end after it starts.",
});
const AvailabilitySchema = z.object({
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  weekly: z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(Range).max(6)),
  overrides: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date for each override"), ranges: z.array(Range).max(6) })).max(200),
});

export async function saveAvailability(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let data: z.infer<typeof AvailabilitySchema>;
  try {
    const parsed = AvailabilitySchema.safeParse(JSON.parse(String(formData.get("payload") ?? "{}")));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your hours" };
    data = parsed.data;
  } catch {
    return { error: "Please check your hours" };
  }
  const weekly = Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((d) => [d, data.weekly[d as keyof WeeklyHours] ?? []])) as WeeklyHours;
  const overrides: DateOverride[] = [...new Map(data.overrides.map((o) => [o.date, o])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const db = getDb();
  await db.update(schema.users).set({ timezone: data.timezone }).where(eq(schema.users.id, user.id));
  await db
    .insert(schema.availability)
    .values({ userId: user.id, weekly, overrides })
    .onConflictDoUpdate({ target: schema.availability.userId, set: { weekly, overrides } });
  revalidatePath("/admin/availability");
  return { ok: true, message: "Saved ✓" };
}

/* ---------------- profile & branding ---------------- */

const MAX_IMAGE_CHARS = 700_000; // ~500 KB image after base64

const ProfileSchema = z.object({
  name: z.string().trim().max(80),
  username: z.string().trim().min(2, "Your link name needs at least 2 characters").max(40),
  bio: z.string().max(1000),
  brandColor: z.string().refine(isHexColor, "Pick a color"),
  logo: z.string().max(MAX_IMAGE_CHARS, "Logo image is too large").optional(),
  cover: z.string().max(MAX_IMAGE_CHARS, "Cover image is too large").optional(),
});

function imageField(v: string | undefined, current: string | null): string | null {
  if (v === undefined || v === "keep") return current;
  if (v === "") return null;
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return current;
  return v;
}

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const v = parsed.data;
  const username = slugify(v.username);
  if (username.length < 2 || RESERVED_USERNAMES.has(username)) return { error: "That link name isn't available." };
  const db = getDb();
  const taken = await db.query.users.findFirst({ where: and(eq(schema.users.username, username), ne(schema.users.id, user.id)) });
  if (taken) return { error: "That link name is taken. Try another." };
  const logo = imageField(v.logo, user.logo);
  const cover = imageField(v.cover, user.cover);
  await db
    .update(schema.users)
    .set({
      name: v.name,
      username,
      bio: v.bio,
      brandColor: v.brandColor.toLowerCase(),
      logo,
      cover,
      imagesVersion: logo !== user.logo || cover !== user.cover ? user.imagesVersion + 1 : user.imagesVersion,
    })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved ✓" };
}

/* ---------------- calendar ---------------- */

export async function connectFakeCalendar() {
  const user = await requireUser();
  if (process.env.CALENDAR_PROVIDER !== "fake") return;
  await getDb()
    .insert(schema.calendarConnections)
    .values({ userId: user.id, provider: "fake", accountEmail: "test-calendar@example.com", busyCalendarIds: ["primary"] })
    .onConflictDoNothing();
  revalidatePath("/admin/settings");
}

export async function disconnectCalendar() {
  const user = await requireUser();
  await getDb().delete(schema.calendarConnections).where(eq(schema.calendarConnections.userId, user.id));
  revalidatePath("/admin", "layout");
}

export async function saveCalendarChoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const cal = await getCalendar(user.id);
  if (!cal) return { error: "Connect a calendar first." };
  const known = new Set((await cal.provider.listCalendars()).map((c) => c.id));
  const busy = formData.getAll("busy").map(String).filter((id) => known.has(id));
  const write = String(formData.get("write") ?? "primary");
  await getDb()
    .update(schema.calendarConnections)
    .set({ busyCalendarIds: busy, writeCalendarId: known.has(write) ? write : "primary", lastError: null })
    .where(eq(schema.calendarConnections.userId, user.id));
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved ✓" };
}

/* ---------------- team ---------------- */

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give your team a name." };
  if (await getMembership(user.id)) return { error: "You're already on a team." };
  await createTeam(user, name);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Team created ✓" };
}

async function requireTeamOwner() {
  const user = await requireUser();
  const m = await getMembership(user.id);
  if (!m || m.role !== "owner") redirect("/admin/team");
  return { user, team: m.team };
}

export async function renameTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { team } = await requireTeamOwner();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give your team a name." };
  const err = await renameTeam(team, name, String(formData.get("slug") ?? ""));
  if (err) return { error: err };
  revalidatePath("/admin/team");
  return { ok: true, message: "Saved ✓" };
}

export async function inviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, team } = await requireTeamOwner();
  const email = String(formData.get("email") ?? "");
  const err = await inviteToTeam(team, user, email);
  if (err) return { error: err };
  revalidatePath("/admin/team");
  return { ok: true, message: `Invite sent to ${email.trim().toLowerCase()} ✓` };
}

export async function revokeInviteAction(formData: FormData) {
  const { team } = await requireTeamOwner();
  await getDb()
    .delete(schema.teamInvites)
    .where(and(eq(schema.teamInvites.teamId, team.id), eq(schema.teamInvites.tokenHash, String(formData.get("id") ?? ""))));
  revalidatePath("/admin/team");
}

export async function removeMemberAction(formData: FormData) {
  const { team } = await requireTeamOwner();
  await removeMember(team, String(formData.get("userId") ?? ""));
  revalidatePath("/admin/team");
}

/* ---------------- Zoom ---------------- */

export async function disconnectZoom() {
  const user = await requireUser();
  await getDb().delete(schema.zoomConnections).where(eq(schema.zoomConnections.userId, user.id));
  revalidatePath("/admin/settings");
}

/** Test mode only (CALENDAR_PROVIDER=fake): a pretend Zoom account. */
export async function connectFakeZoom() {
  const user = await requireUser();
  if (process.env.CALENDAR_PROVIDER !== "fake") return;
  await getDb()
    .insert(schema.zoomConnections)
    .values({ userId: user.id, accountEmail: "test-zoom@example.com", refreshTokenEnc: "fake" })
    .onConflictDoNothing();
  revalidatePath("/admin/settings");
}
