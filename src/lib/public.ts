import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { getUserByUsername } from "./users";

export async function getPublicProfile(username: string) {
  const owner = await getUserByUsername(username);
  if (!owner) return null;
  const events = await getDb()
    .select()
    .from(schema.eventTypes)
    .where(and(eq(schema.eventTypes.userId, owner.id), eq(schema.eventTypes.active, true)))
    .orderBy(asc(schema.eventTypes.position), asc(schema.eventTypes.createdAt));
  return { owner, events };
}

export async function getPublicEvent(username: string, slug: string) {
  const owner = await getUserByUsername(username);
  if (!owner) return null;
  const eventType = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.userId, owner.id), eq(schema.eventTypes.slug, slug.toLowerCase())),
  });
  if (!eventType || !eventType.active) return null;
  return { owner, eventType };
}

export function imageUrl(owner: { username: string; imagesVersion: number }, kind: "logo" | "cover") {
  return `/api/img/${owner.username}/${kind}?v=${owner.imagesVersion}`;
}
