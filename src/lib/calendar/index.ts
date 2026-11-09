import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { decrypt, encrypt } from "../crypto";
import { fakeCalendar } from "./fake";
import { googleCalendar, refreshAccessToken } from "./google";
import type { CalendarProvider } from "./types";
import type { CalendarConnection } from "../db/schema";

export type ConnectedCalendar = { conn: CalendarConnection; provider: CalendarProvider };

/** Returns the owner's connected calendar, or null if they haven't connected one yet. */
export async function getCalendar(userId: string): Promise<ConnectedCalendar | null> {
  const db = getDb();
  const conn = await db.query.calendarConnections.findFirst({
    where: eq(schema.calendarConnections.userId, userId),
  });
  if (!conn) return null;
  if (conn.provider === "fake") return { conn, provider: fakeCalendar(userId) };
  if (!conn.refreshTokenEnc) return null;

  const getAccessToken = async () => {
    if (conn.accessTokenEnc && conn.accessTokenExpiresAt && conn.accessTokenExpiresAt > Date.now() + 60_000) {
      return decrypt(conn.accessTokenEnc);
    }
    const t = await refreshAccessToken(decrypt(conn.refreshTokenEnc!));
    conn.accessTokenEnc = encrypt(t.access_token);
    conn.accessTokenExpiresAt = Date.now() + t.expires_in * 1000;
    await db
      .update(schema.calendarConnections)
      .set({ accessTokenEnc: conn.accessTokenEnc, accessTokenExpiresAt: conn.accessTokenExpiresAt, lastError: null })
      .where(eq(schema.calendarConnections.userId, userId));
    return t.access_token;
  };
  return { conn, provider: googleCalendar(getAccessToken) };
}

export async function recordCalendarError(userId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[calendar] ${message}`);
  await getDb()
    .update(schema.calendarConnections)
    .set({ lastError: `${new Date().toISOString()} ${message}`.slice(0, 500) })
    .where(eq(schema.calendarConnections.userId, userId));
}
