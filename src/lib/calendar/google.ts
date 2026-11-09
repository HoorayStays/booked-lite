/**
 * Google Calendar over plain HTTPS (no SDK, keeps the app small).
 * Scopes: read busy times + create/update/delete the events this app books.
 */
import type { CalendarProvider, CalendarEventInput } from "./types";
import { appUrl } from "../env";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const API = "https://www.googleapis.com/calendar/v3";

export function googleRedirectUri() {
  return `${appUrl()}/api/google/callback`;
}

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) throw new Error(`Google token error: ${json.error_description || json.error || res.status}`);
  return json;
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

/** The id_token comes straight from Google over TLS, so reading its payload is safe here. */
export function emailFromIdToken(idToken?: string): string {
  if (!idToken) return "";
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : "";
  } catch {
    return "";
  }
}

function eventBody(ev: CalendarEventInput, requestId?: string) {
  return {
    ...(requestId
      ? { conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } } }
      : {}),
    summary: ev.title,
    description: ev.description,
    location: ev.location,
    start: { dateTime: new Date(ev.start).toISOString(), timeZone: ev.timeZone },
    end: { dateTime: new Date(ev.end).toISOString(), timeZone: ev.timeZone },
    attendees: [{ email: ev.attendee.email, displayName: ev.attendee.name, responseStatus: "accepted" }],
    reminders: { useDefault: true },
  };
}

export function googleCalendar(getAccessToken: () => Promise<string>): CalendarProvider {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
    });
    if (res.status === 204 || res.status === 410) return undefined as T; // 410 = already deleted
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${json?.error?.message ?? "request failed"}`);
    return json as T;
  }

  return {
    async busy(calendarIds, from, to) {
      if (calendarIds.length === 0) return [];
      const data = await call<{ calendars: Record<string, { busy?: { start: string; end: string }[] }> }>(
        "/freeBusy",
        {
          method: "POST",
          body: JSON.stringify({
            timeMin: new Date(from).toISOString(),
            timeMax: new Date(to).toISOString(),
            items: calendarIds.map((id) => ({ id })),
          }),
        },
      );
      return Object.values(data.calendars ?? {}).flatMap((c) =>
        (c.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
      );
    },
    async createEvent(calendarId, ev) {
      const requestId = ev.withMeet ? `booked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : undefined;
      const data = await call<{ id: string; hangoutLink?: string }>(
        `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none${requestId ? "&conferenceDataVersion=1" : ""}`,
        { method: "POST", body: JSON.stringify(eventBody(ev, requestId)) },
      );
      return { id: data.id, meetUrl: data.hangoutLink };
    },
    async updateEvent(calendarId, eventId, ev) {
      await call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
        method: "PATCH",
        body: JSON.stringify(eventBody(ev)),
      });
    },
    async deleteEvent(calendarId, eventId) {
      await call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
        method: "DELETE",
      });
    },
    async listCalendars() {
      const data = await call<{ items?: { id: string; summary: string; primary?: boolean; accessRole: string }[] }>(
        "/users/me/calendarList?minAccessRole=freeBusyReader",
      );
      return (data.items ?? []).map((c) => ({ id: c.primary ? "primary" : c.id, name: c.summary, primary: !!c.primary }));
    },
  };
}
