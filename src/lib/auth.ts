import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "./db";
import { randomToken, sha256 } from "./crypto";
import { appUrl } from "./env";
import { sendEmail } from "./email/send";
import { magicLinkEmail } from "./email/templates";
import { ensureUser } from "./users";
import { isAllowedEmail } from "./teams";

const COOKIE = "booked_session";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 15;

/**
 * Emails a one-time sign-in link. Returns the link itself only so local development
 * can show it on screen when email isn't configured yet.
 */
export async function requestMagicLink(rawEmail: string): Promise<{ link?: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!(await isAllowedEmail(email))) return {};
  const db = getDb();
  const recent = await db
    .select()
    .from(schema.loginTokens)
    .where(and(eq(schema.loginTokens.email, email), gt(schema.loginTokens.expiresAt, Date.now()), isNull(schema.loginTokens.usedAt)));
  if (recent.length >= 5) return {}; // simple abuse guard
  const token = randomToken();
  await db.insert(schema.loginTokens).values({
    tokenHash: sha256(token),
    email,
    expiresAt: Date.now() + TOKEN_MINUTES * 60_000,
  });
  const link = `${appUrl()}/login/verify?token=${token}`;
  await sendEmail({ to: email, ...magicLinkEmail(link) });
  return { link };
}

/** Consumes a magic-link token and starts a session. Returns false if invalid/expired. */
export async function verifyMagicLink(token: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.loginTokens.findFirst({ where: eq(schema.loginTokens.tokenHash, sha256(token)) });
  if (!row || row.usedAt || row.expiresAt < Date.now() || !(await isAllowedEmail(row.email))) return false;
  await db.update(schema.loginTokens).set({ usedAt: Date.now() }).where(eq(schema.loginTokens.tokenHash, row.tokenHash));
  await db.delete(schema.loginTokens).where(lt(schema.loginTokens.expiresAt, Date.now() - 86_400_000));
  const user = await ensureUser(row.email);
  await createSession(user.id);
  return true;
}

export async function createSession(userId: string) {
  const value = randomToken();
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000;
  await getDb().insert(schema.sessions).values({ id: sha256(value), userId, expiresAt });
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl().startsWith("https://"),
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getCurrentUser() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const db = getDb();
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sha256(value)) });
  if (!session || session.expiresAt < Date.now()) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user || !(await isAllowedEmail(user.email))) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function signOut() {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (value) await getDb().delete(schema.sessions).where(eq(schema.sessions.id, sha256(value)));
  jar.delete(COOKIE);
}
