import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { randomId } from "./crypto";
import { DEFAULT_WEEKLY } from "./types";

export const RESERVED_USERNAMES = new Set([
  "admin", "api", "login", "logout", "booking", "bookings", "_next", "static", "public",
  "favicon.ico", "robots.txt", "sitemap.xml", "settings", "help",
]);

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop accents: é → e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueUsername(base: string): Promise<string> {
  const db = getDb();
  let candidate = slugify(base) || "host";
  if (RESERVED_USERNAMES.has(candidate)) candidate = `${candidate}-host`;
  for (let i = 0; i < 50; i++) {
    const name = i === 0 ? candidate : `${candidate}-${i + 1}`;
    const taken = await db.query.users.findFirst({ where: eq(schema.users.username, name) });
    if (!taken) return name;
  }
  return `${candidate}-${randomId(4)}`;
}

/** Finds the user for an email, creating them (with sensible defaults) on first sign-in. */
export async function ensureUser(email: string) {
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return existing;
  const id = randomId(20);
  const username = await uniqueUsername(email.split("@")[0]);
  const [user] = await db
    .insert(schema.users)
    .values({ id, email, username, name: "", timezone: process.env.DEFAULT_TIMEZONE || "America/New_York" })
    .returning();
  await db.insert(schema.availability).values({ userId: id, weekly: DEFAULT_WEEKLY, overrides: [] });
  await db.insert(schema.eventTypes).values({
    id: randomId(20),
    userId: id,
    slug: "quick-chat",
    title: "Quick chat",
    description: "A short video call to say hi and see how I can help.",
    durationMin: 30,
    questions: [],
  });
  return user;
}

export async function getUserByUsername(username: string) {
  return getDb().query.users.findFirst({ where: eq(schema.users.username, username.toLowerCase()) });
}
