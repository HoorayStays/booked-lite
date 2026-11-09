/**
 * Simple teams: one owner invites teammates by email. Each teammate has their own booking pages and
 * calendar; the owner can also create team event types (round robin or everyone-must-be-free).
 * Roles/permissions beyond "owner" and "member" are intentionally out of scope.
 */
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { EventType, Team, User } from "./db/schema";
import { randomId, randomToken, sha256 } from "./crypto";
import { allowedEmails, appUrl, guestEmailMode } from "./env";
import { sendEmail } from "./email/send";
import { teamInviteEmail } from "./email/templates";
import { RESERVED_USERNAMES, ensureUser, slugify } from "./users";

const INVITE_DAYS = 7;

export async function getMembership(userId: string) {
  const db = getDb();
  const m = await db.query.teamMembers.findFirst({ where: eq(schema.teamMembers.userId, userId) });
  if (!m) return null;
  const team = await db.query.teams.findFirst({ where: eq(schema.teams.id, m.teamId) });
  return team ? { team, role: m.role } : null;
}

export async function getTeamBySlug(slug: string) {
  return getDb().query.teams.findFirst({ where: eq(schema.teams.slug, slug.toLowerCase()) });
}

export async function listMembers(teamId: string) {
  const db = getDb();
  const rows = await db
    .select({ user: schema.users, role: schema.teamMembers.role })
    .from(schema.teamMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.teamMembers.userId))
    .where(eq(schema.teamMembers.teamId, teamId));
  return rows.sort((a, b) => (a.role === b.role ? a.user.email.localeCompare(b.user.email) : a.role === "owner" ? -1 : 1));
}

/** Who may sign in: emails in ALLOWED_EMAILS, plus current members of a team. */
export async function isAllowedEmail(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (allowedEmails().includes(e)) return true;
  const rows = await getDb()
    .select({ id: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.teamMembers, eq(schema.teamMembers.userId, schema.users.id))
    .where(eq(schema.users.email, e))
    .limit(1);
  return rows.length > 0;
}

async function uniqueTeamSlug(name: string) {
  const db = getDb();
  const base = slugify(name) || "team";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.query.teams.findFirst({ where: eq(schema.teams.slug, slug) }))) return slug;
  }
  return `${base}-${randomId(4)}`;
}

export async function createTeam(owner: User, name: string): Promise<Team> {
  const existing = await getMembership(owner.id);
  if (existing) return existing.team;
  const db = getDb();
  const [team] = await db
    .insert(schema.teams)
    .values({ id: randomId(20), ownerId: owner.id, name, slug: await uniqueTeamSlug(name) })
    .returning();
  await db.insert(schema.teamMembers).values({ userId: owner.id, teamId: team.id, role: "owner" });
  return team;
}

export async function renameTeam(team: Team, name: string, slugInput: string) {
  const db = getDb();
  const slug = slugify(slugInput || name);
  if (!slug || RESERVED_USERNAMES.has(slug)) return "That team link isn't available.";
  const clash = await db.query.teams.findFirst({ where: eq(schema.teams.slug, slug) });
  if (clash && clash.id !== team.id) return "That team link is taken.";
  await db.update(schema.teams).set({ name, slug }).where(eq(schema.teams.id, team.id));
  return null;
}

/**
 * Emails a join link. Returns { error } for the admin, or { link } when the link must be shared by hand
 * (no verified email domain yet, so Resend can't reach the teammate).
 */
export async function inviteToTeam(team: Team, inviter: User, rawEmail: string): Promise<{ error?: string; link?: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email." };
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (user) {
    const m = await getMembership(user.id);
    if (m?.team.id === team.id) return { error: "They're already on your team." };
    if (m) return { error: "That person is already on another team." };
  }
  const token = randomToken();
  await db.insert(schema.teamInvites).values({
    tokenHash: sha256(token),
    teamId: team.id,
    email,
    expiresAt: Date.now() + INVITE_DAYS * 86_400_000,
  });
  const link = `${appUrl()}/invite/${token}`;
  await sendEmail({ to: email, ...teamInviteEmail(team.name, inviter.name || inviter.email, link) });
  return guestEmailMode() === "forward-to-host" ? { link } : {};
}

export async function pendingInvites(teamId: string) {
  return getDb()
    .select()
    .from(schema.teamInvites)
    .where(and(eq(schema.teamInvites.teamId, teamId), isNull(schema.teamInvites.acceptedAt), gt(schema.teamInvites.expiresAt, Date.now())));
}

export async function findInvite(token: string) {
  const db = getDb();
  const invite = await db.query.teamInvites.findFirst({ where: eq(schema.teamInvites.tokenHash, sha256(token)) });
  if (!invite || invite.acceptedAt || invite.expiresAt < Date.now()) return null;
  const team = await db.query.teams.findFirst({ where: eq(schema.teams.id, invite.teamId) });
  return team ? { invite, team } : null;
}

/** Accepts an invite: creates the teammate's account (with their own booking page) and joins the team. */
export async function acceptInvite(token: string): Promise<User | null> {
  const found = await findInvite(token);
  if (!found) return null;
  const db = getDb();
  await db.update(schema.teamInvites).set({ acceptedAt: Date.now() }).where(eq(schema.teamInvites.tokenHash, found.invite.tokenHash));
  const user = await ensureUser(found.invite.email);
  const current = await getMembership(user.id);
  if (current && current.team.id !== found.team.id) return null;
  if (!current) await db.insert(schema.teamMembers).values({ userId: user.id, teamId: found.team.id, role: "member" });
  return user;
}

/** Removes a teammate: they lose sign-in access, their pages go offline, and they stop hosting team events. */
export async function removeMember(team: Team, userId: string) {
  if (userId === team.ownerId) return;
  const db = getDb();
  await db.delete(schema.teamMembers).where(and(eq(schema.teamMembers.teamId, team.id), eq(schema.teamMembers.userId, userId)));
  const teamEvents = await db.select({ id: schema.eventTypes.id }).from(schema.eventTypes).where(eq(schema.eventTypes.teamId, team.id));
  if (teamEvents.length) {
    await db
      .delete(schema.eventTypeHosts)
      .where(and(eq(schema.eventTypeHosts.userId, userId), inArray(schema.eventTypeHosts.eventTypeId, teamEvents.map((e) => e.id))));
  }
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (user && !(await isAllowedEmail(user.email))) {
    await db.update(schema.eventTypes).set({ active: false }).where(eq(schema.eventTypes.userId, userId));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }
}

/** The people who host an event type: the owner for personal events, the chosen teammates for team events. */
export async function getEventHosts(et: EventType): Promise<User[]> {
  const db = getDb();
  if (!et.teamId) {
    const owner = await db.query.users.findFirst({ where: eq(schema.users.id, et.userId) });
    return owner ? [owner] : [];
  }
  const rows = await db
    .select({ user: schema.users })
    .from(schema.eventTypeHosts)
    .innerJoin(schema.users, eq(schema.users.id, schema.eventTypeHosts.userId))
    .innerJoin(schema.teamMembers, and(eq(schema.teamMembers.userId, schema.users.id), eq(schema.teamMembers.teamId, et.teamId)))
    .where(eq(schema.eventTypeHosts.eventTypeId, et.id));
  return rows.map((r) => r.user).sort((a, b) => a.id.localeCompare(b.id));
}

export async function setEventHosts(eventTypeId: string, teamId: string, userIds: string[]) {
  const db = getDb();
  const members = new Set((await listMembers(teamId)).map((m) => m.user.id));
  const valid = [...new Set(userIds)].filter((id) => members.has(id));
  await db.delete(schema.eventTypeHosts).where(eq(schema.eventTypeHosts.eventTypeId, eventTypeId));
  if (valid.length) await db.insert(schema.eventTypeHosts).values(valid.map((userId) => ({ eventTypeId, userId })));
  return valid;
}
