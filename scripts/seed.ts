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

  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) await db.delete(schema.users).where(eq(schema.users.id, existing.id));

  const userId = "demo-user";
  await db.insert(schema.users).values({
    id: userId,
    email,
    username: "demo",
    name: "Sunny Stays Co.",
    bio: "We host 12 homes on the Gulf Coast. Grab a time to talk about co-hosting, cleaning schedules, or your next stay.",
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
  if (process.env.CALENDAR_PROVIDER === "fake") {
    await db.insert(schema.calendarConnections).values({
      userId,
      provider: "fake",
      accountEmail: "test-calendar@example.com",
      busyCalendarIds: ["primary"],
    });
  }
  console.log(`✓ Seeded demo host "${email}" → open http://localhost:3000/demo`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
