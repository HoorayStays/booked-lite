import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { EventType, Team, User } from "./db/schema";
import { getUserByUsername } from "./users";
import { getTeamBySlug } from "./teams";

export type PublicEvent = { eventType: EventType; owner: User; team: Team | null };

const orderBy = [asc(schema.eventTypes.position), asc(schema.eventTypes.createdAt)];

/** A person's page: their own (non-team) event types. */
export async function getPublicProfile(username: string) {
  const owner = await getUserByUsername(username);
  if (!owner) return null;
  const events = await getDb()
    .select()
    .from(schema.eventTypes)
    .where(and(eq(schema.eventTypes.userId, owner.id), eq(schema.eventTypes.active, true), isNull(schema.eventTypes.teamId)))
    .orderBy(...orderBy);
  return { owner, events };
}

/** A team's page: team event types, branded like the team owner. */
export async function getPublicTeam(slug: string) {
  const team = await getTeamBySlug(slug);
  if (!team) return null;
  const db = getDb();
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, team.ownerId) });
  if (!owner) return null;
  const events = await db
    .select()
    .from(schema.eventTypes)
    .where(and(eq(schema.eventTypes.teamId, team.id), eq(schema.eventTypes.active, true)))
    .orderBy(...orderBy);
  return { team, owner, events };
}

export async function getPublicEvent(username: string, slug: string): Promise<PublicEvent | null> {
  const owner = await getUserByUsername(username);
  if (!owner) return null;
  const eventType = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.userId, owner.id), eq(schema.eventTypes.slug, slug.toLowerCase()), isNull(schema.eventTypes.teamId)),
  });
  if (!eventType || !eventType.active) return null;
  return { owner, eventType, team: null };
}

export async function getTeamEvent(teamSlug: string, slug: string): Promise<PublicEvent | null> {
  const found = await getPublicTeam(teamSlug);
  const eventType = found?.events.find((e) => e.slug === slug.toLowerCase());
  if (!found || !eventType) return null;
  return { owner: found.owner, eventType, team: found.team };
}

/** Used by the booking API: any active event type by id. */
export async function getEventById(id: string): Promise<PublicEvent | null> {
  const db = getDb();
  const eventType = await db.query.eventTypes.findFirst({ where: eq(schema.eventTypes.id, id) });
  if (!eventType || !eventType.active) return null;
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, eventType.userId) });
  if (!owner) return null;
  const team = eventType.teamId ? ((await db.query.teams.findFirst({ where: eq(schema.teams.id, eventType.teamId) })) ?? null) : null;
  if (eventType.teamId && !team) return null;
  return { eventType, owner, team };
}

export function imageUrl(owner: { username: string; imagesVersion: number }, kind: "logo" | "cover") {
  return `/api/img/${owner.username}/${kind}?v=${owner.imagesVersion}`;
}
