import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from "drizzle-orm/sqlite-core";
import type { WeeklyHours, DateOverride, Question, LocationType, SchedulingType } from "@/lib/types";

const LOCATION_TYPES = ["jitsi", "link", "phone", "in_person", "zoom", "google_meet"] as const satisfies readonly LocationType[];

/** Times are stored as UTC epoch milliseconds. */
const now = () => Date.now();

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  username: text("username").notNull().unique(),
  bio: text("bio").notNull().default(""),
  timezone: text("timezone").notNull().default("America/New_York"),
  brandColor: text("brand_color").notNull().default("#4f46e5"),
  // Images are stored as small, resized data URLs so no extra storage account is needed.
  logo: text("logo"),
  cover: text("cover"),
  imagesVersion: integer("images_version").notNull().default(0),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie value
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const loginTokens = sqliteTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
});

export const availability = sqliteTable("availability", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weekly: text("weekly", { mode: "json" }).$type<WeeklyHours>().notNull(),
  overrides: text("overrides", { mode: "json" }).$type<DateOverride[]>().notNull(),
});

export const calendarConnections = sqliteTable("calendar_connections", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["google", "fake"] }).notNull(),
  accountEmail: text("account_email").notNull().default(""),
  refreshTokenEnc: text("refresh_token_enc"),
  accessTokenEnc: text("access_token_enc"),
  accessTokenExpiresAt: integer("access_token_expires_at"),
  /** Calendars checked for conflicts. New bookings are written to `writeCalendarId`. */
  busyCalendarIds: text("busy_calendar_ids", { mode: "json" }).$type<string[]>().notNull(),
  writeCalendarId: text("write_calendar_id").notNull().default("primary"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const eventTypes = sqliteTable(
  "event_types",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    durationMin: integer("duration_min").notNull().default(30),
    bufferBeforeMin: integer("buffer_before_min").notNull().default(0),
    bufferAfterMin: integer("buffer_after_min").notNull().default(0),
    minNoticeMin: integer("min_notice_min").notNull().default(240),
    dailyLimit: integer("daily_limit"),
    slotStepMin: integer("slot_step_min").notNull().default(30),
    maxDaysAhead: integer("max_days_ahead").notNull().default(60),
    locationType: text("location_type", { enum: LOCATION_TYPES }).notNull().default("jitsi"),
    locationValue: text("location_value").notNull().default(""),
    questions: text("questions", { mode: "json" }).$type<Question[]>().notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    /** Set for team event types (hosts are listed in event_type_hosts). */
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    schedulingType: text("scheduling_type", { enum: ["round_robin", "collective"] }).$type<SchedulingType>(),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("event_types_user_slug").on(t.userId, t.slug)],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventTypeId: text("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    startUtc: integer("start_utc").notNull(),
    endUtc: integer("end_utc").notNull(),
    guestName: text("guest_name").notNull(),
    guestEmail: text("guest_email").notNull(),
    guestTimezone: text("guest_timezone").notNull(),
    answers: text("answers", { mode: "json" }).$type<Record<string, string>>().notNull(),
    locationType: text("location_type", { enum: LOCATION_TYPES }).notNull(),
    locationValue: text("location_value").notNull().default(""),
    status: text("status", { enum: ["confirmed", "cancelled"] }).notNull().default("confirmed"),
    /** Secret used in the guest's reschedule / cancel links. */
    manageToken: text("manage_token").notNull(),
    /** Incremented on every change so calendar apps update the invite (ICS SEQUENCE). */
    sequence: integer("sequence").notNull().default(0),
    /** @deprecated v0.1 only. Calendar event ids now live in booking_hosts. */
    calendarEventId: text("calendar_event_id"),
    /** Zoom meeting id (when the meeting was auto-created) and its passcode. */
    meetingId: text("meeting_id"),
    meetingPassword: text("meeting_password"),
    reminderSentAt: integer("reminder_sent_at"),
    cancelReason: text("cancel_reason"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("bookings_user_start").on(t.userId, t.startUtc)],
);

/** Everyone hosting a booking (1 person, or several for "everyone must be free" team events). */
export const bookingHosts = sqliteTable(
  "booking_hosts",
  {
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calendarEventId: text("calendar_event_id"),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.userId] }), index("booking_hosts_user").on(t.userId)],
);

/* ---------------- teams ---------------- */

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

/** A person belongs to at most one team (kept simple on purpose). */
export const teamMembers = sqliteTable("team_members", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const teamInvites = sqliteTable("team_invites", {
  tokenHash: text("token_hash").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  expiresAt: integer("expires_at").notNull(),
  acceptedAt: integer("accepted_at"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const eventTypeHosts = sqliteTable(
  "event_type_hosts",
  {
    eventTypeId: text("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventTypeId, t.userId] })],
);

/* ---------------- Zoom ---------------- */

export const zoomConnections = sqliteTable("zoom_connections", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accountEmail: text("account_email").notNull().default(""),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  accessTokenEnc: text("access_token_enc"),
  accessTokenExpiresAt: integer("access_token_expires_at"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export type User = typeof users.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Availability = typeof availability.$inferSelect;
export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type ZoomConnection = typeof zoomConnections.$inferSelect;
