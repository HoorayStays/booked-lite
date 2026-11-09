/**
 * Fills a LOCAL database with a demo host so you can click around without any accounts.
 * Usage: npm run db:seed   (then open http://localhost:3000/demo)
 * Refuses to run against a remote (Turso) database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { DEFAULT_WEEKLY } from "../src/lib/types";

async function main() {
  const url = process.env.DATABASE_URL || "file:.data/local.db";
  if (!url.startsWith("file:")) throw new Error("Seeding only runs on a local database (DATABASE_URL=file:...).");
  const db = drizzle(createClient({ url }), { schema });
  const email = (process.env.SEED_EMAIL || "demo@example.com").toLowerCase();

  const teammateEmail = "jordan@example.com";
  for (const e of [email, teammateEmail]) {
    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, e) });
    if (existing) await db.delete(schema.users).where(eq(schema.users.id, existing.id));
  }

  const userId = "demo-user";
  await db.insert(schema.users).values({
    id: userId,
    email,
    username: "demo",
    name: "Example Stays Co.",
    bio: "We host 12 vacation homes. Grab a time to talk about co-hosting, cleaning schedules, or your next stay.",
    timezone: "America/Chicago",
    brandColor: "#0f766e",
  });
  await db.insert(schema.availability).values({
    userId,
    weekly: { ...DEFAULT_WEEKLY, "6": [{ start: "10:00", end: "13:00" }] },
    overrides: [],
  });
  await db.insert(schema.eventTypes).values([
    {
      id: "demo-intro",
      userId,
      slug: "intro-call",
      title: "Owner intro call",
      description: "A friendly 30-minute video call for property owners thinking about co-hosting.\nWe'll look at your listing together and talk numbers.",
      durationMin: 30,
      bufferAfterMin: 10,
      minNoticeMin: 120,
      locationType: "jitsi",
      questions: [
        { id: "address", label: "Property address", type: "text", required: true },
        { id: "goals", label: "Anything we should know?", type: "textarea", required: false },
      ],
      position: 0,
    },
    {
      id: "demo-walkthrough",
      userId,
      slug: "walkthrough",
      title: "On-site walkthrough",
      description: "We visit your property and put together a launch checklist.",
      durationMin: 60,
      bufferBeforeMin: 30,
      bufferAfterMin: 30,
      minNoticeMin: 24 * 60,
      dailyLimit: 2,
      slotStepMin: 60,
      locationType: "in_person",
      locationValue: "Your property (we'll confirm the address)",
      questions: [],
      position: 1,
    },
    {
      id: "demo-phone",
      userId,
      slug: "quick-call",
      title: "15-minute phone call",
      description: "Quick questions? We'll call you.",
      durationMin: 15,
      slotStepMin: 15,
      locationType: "phone",
      questions: [],
      position: 2,
    },
  ]);
  await db.insert(schema.eventTypes).values({
    id: "demo-zoom",
    userId,
    slug: "zoom-consult",
    title: "Zoom consult",
    description: "A 45-minute Zoom call. You'll get the link and passcode by email.",
    durationMin: 45,
    locationType: "zoom",
    questions: [],
    position: 3,
  });

  // A small team: the demo host + one teammate in another timezone.
  const mateId = "demo-teammate";
  await db.insert(schema.users).values({
    id: mateId,
    email: teammateEmail,
    username: "jordan",
    name: "Jordan Lee",
    timezone: "America/Denver",
    brandColor: "#0f766e",
  });
  await db.insert(schema.availability).values({ userId: mateId, weekly: DEFAULT_WEEKLY, overrides: [] });
  await db.insert(schema.teams).values({ id: "demo-team", ownerId: userId, name: "Example Stays Team", slug: "example-stays" });
  await db.insert(schema.teamMembers).values([
    { userId, teamId: "demo-team", role: "owner" },
    { userId: mateId, teamId: "demo-team", role: "member" },
  ]);
  await db.insert(schema.eventTypes).values([
    {
      id: "demo-rr",
      userId,
      teamId: "demo-team",
      schedulingType: "round_robin",
      slug: "assessment",
      title: "Free property assessment",
      description: "Talk to the next available member of our team.",
      durationMin: 30,
      minNoticeMin: 60,
      locationType: "google_meet",
      questions: [],
    },
    {
      id: "demo-all",
      userId,
      teamId: "demo-team",
      schedulingType: "collective",
      slug: "kickoff",
      title: "Owner kickoff (whole team)",
      description: "Meet everyone who'll look after your home.",
      durationMin: 60,
      slotStepMin: 60,
      minNoticeMin: 60,
      locationType: "jitsi",
      questions: [],
    },
  ]);
  await db.insert(schema.eventTypeHosts).values([
    { eventTypeId: "demo-rr", userId },
    { eventTypeId: "demo-rr", userId: mateId },
    { eventTypeId: "demo-all", userId },
    { eventTypeId: "demo-all", userId: mateId },
  ]);

  if (process.env.CALENDAR_PROVIDER === "fake") {
    for (const id of [userId, mateId]) {
      await db.insert(schema.calendarConnections).values({
        userId: id,
        provider: "fake",
        accountEmail: "test-calendar@example.com",
        busyCalendarIds: ["primary"],
      });
    }
    await db.insert(schema.zoomConnections).values({ userId, accountEmail: "test-zoom@example.com", refreshTokenEnc: "fake" });
  }
  console.log(`✓ Seeded demo host "${email}" → open http://localhost:3000/demo`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
