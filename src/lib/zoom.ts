/**
 * Zoom over plain HTTPS (OAuth "General app", user-managed). Each host connects their own Zoom account.
 * Zoom rotates refresh tokens: every refresh returns a new one, which we must save.
 * With CALENDAR_PROVIDER=fake (tests) a pretend Zoom is used instead.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { appUrl, fakeCalendarEnabled } from "./env";
import { decrypt, encrypt, randomId } from "./crypto";

export type ZoomMeetingInput = { topic: string; start: number; durationMin: number; timeZone: string; agenda: string };
export type ZoomMeeting = { id: string; joinUrl: string; password: string };

export interface ZoomClient {
  createMeeting(m: ZoomMeetingInput): Promise<ZoomMeeting>;
  updateMeeting(id: string, m: ZoomMeetingInput): Promise<void>;
  deleteMeeting(id: string): Promise<void>;
}

export function zoomRedirectUri() {
  return `${appUrl()}/api/zoom/callback`;
}

export function zoomAuthUrl(state: string) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID!,
    redirect_uri: zoomRedirectUri(),
    state,
  });
  return `https://zoom.us/oauth/authorize?${p}`;
}

type ZoomToken = { access_token: string; refresh_token: string; expires_in: number; error?: string; reason?: string };

async function tokenRequest(body: Record<string, string>): Promise<ZoomToken> {
  const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as ZoomToken;
  if (!res.ok || json.error) throw new Error(`Zoom token error: ${json.reason || json.error || res.status}`);
  return json;
}

export function exchangeZoomCode(code: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: zoomRedirectUri() });
}

export async function zoomUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://api.zoom.us/v2/users/me", { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return "";
  const json = (await res.json()) as { email?: string };
  return json.email ?? "";
}

function meetingBody(m: ZoomMeetingInput) {
  return {
    topic: m.topic.slice(0, 200),
    type: 2, // scheduled meeting
    start_time: new Date(m.start).toISOString().replace(/\.\d{3}Z$/, "Z"),
    duration: m.durationMin,
    timezone: m.timeZone,
    agenda: m.agenda.slice(0, 2000),
    settings: { join_before_host: true, waiting_room: false },
  };
}

function realClient(userId: string, conn: typeof schema.zoomConnections.$inferSelect): ZoomClient {
  const db = getDb();
  async function token() {
    if (conn.accessTokenEnc && conn.accessTokenExpiresAt && conn.accessTokenExpiresAt > Date.now() + 60_000) {
      return decrypt(conn.accessTokenEnc);
    }
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(conn.refreshTokenEnc) });
    conn.refreshTokenEnc = encrypt(t.refresh_token);
    conn.accessTokenEnc = encrypt(t.access_token);
    conn.accessTokenExpiresAt = Date.now() + t.expires_in * 1000;
    await db
      .update(schema.zoomConnections)
      .set({
        refreshTokenEnc: conn.refreshTokenEnc,
        accessTokenEnc: conn.accessTokenEnc,
        accessTokenExpiresAt: conn.accessTokenExpiresAt,
        lastError: null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.zoomConnections.userId, userId));
    return t.access_token;
  }
  async function call<T>(p: string, init: RequestInit): Promise<T> {
    const res = await fetch(`https://api.zoom.us/v2${p}`, {
      ...init,
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
    });
    if (res.status === 204 || (init.method === "DELETE" && res.status === 404)) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Zoom ${res.status}: ${(json as { message?: string }).message ?? "request failed"}`);
    return json as T;
  }
  return {
    async createMeeting(m) {
      const r = await call<{ id: number; join_url: string; password?: string }>("/users/me/meetings", {
        method: "POST",
        body: JSON.stringify(meetingBody(m)),
      });
      return { id: String(r.id), joinUrl: r.join_url, password: r.password ?? "" };
    },
    async updateMeeting(id, m) {
      await call(`/meetings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(meetingBody(m)) });
    },
    async deleteMeeting(id) {
      await call(`/meetings/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}

/* ---- pretend Zoom for tests: meetings are kept in a JSON file ---- */
function fakeFile() {
  return process.env.FAKE_ZOOM_FILE || path.join(process.cwd(), ".data", "fake-zoom.json");
}
export function readFakeZoom(): Record<string, ZoomMeetingInput & ZoomMeeting> {
  try {
    return JSON.parse(fs.readFileSync(fakeFile(), "utf8"));
  } catch {
    return {};
  }
}
function writeFakeZoom(data: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(fakeFile()), { recursive: true });
  fs.writeFileSync(fakeFile(), JSON.stringify(data, null, 2));
}
const fakeClient: ZoomClient = {
  async createMeeting(m) {
    const id = String(Date.now()).slice(-10);
    const meeting = { id, joinUrl: `https://zoom.us/j/${id}?pwd=fake`, password: randomId(6) };
    writeFakeZoom({ ...readFakeZoom(), [id]: { ...m, ...meeting } });
    return meeting;
  },
  async updateMeeting(id, m) {
    const all = readFakeZoom();
    if (all[id]) writeFakeZoom({ ...all, [id]: { ...all[id], ...m } });
  },
  async deleteMeeting(id) {
    const all = readFakeZoom();
    delete all[id];
    writeFakeZoom(all);
  },
};

/** The host's Zoom, or null if they haven't connected it. */
export async function getZoom(userId: string): Promise<ZoomClient | null> {
  const conn = await getDb().query.zoomConnections.findFirst({ where: eq(schema.zoomConnections.userId, userId) });
  if (!conn) return null;
  if (fakeCalendarEnabled() && conn.refreshTokenEnc === "fake") return fakeClient;
  return realClient(userId, conn);
}

export async function recordZoomError(userId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[zoom] ${message}`);
  await getDb()
    .update(schema.zoomConnections)
    .set({ lastError: `${new Date().toISOString()} ${message}`.slice(0, 500) })
    .where(eq(schema.zoomConnections.userId, userId));
}
