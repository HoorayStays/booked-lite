import { requireUser } from "@/lib/auth";
import { getCalendar } from "@/lib/calendar";
import type { CalendarInfo } from "@/lib/calendar/types";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { appUrl, fakeCalendarEnabled, googleConfigured, zoomConfigured } from "@/lib/env";
import { zoomRedirectUri } from "@/lib/zoom";
import { googleRedirectUri } from "@/lib/calendar/google";
import { connectFakeCalendar, connectFakeZoom, disconnectCalendar, disconnectZoom } from "../actions";
import { ProfileForm } from "./ProfileForm";
import { CalendarChoice } from "./CalendarChoice";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ calendar?: string; zoom?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cal = await getCalendar(user.id);
  let calendars: CalendarInfo[] = [];
  let listError: string | null = null;
  if (cal) {
    try {
      calendars = await cal.provider.listCalendars();
    } catch (err) {
      listError = err instanceof Error ? err.message : String(err);
    }
  }

  const zoom = await getDb().query.zoomConnections.findFirst({ where: eq(schema.zoomConnections.userId, user.id) });

  return (
    <div className="stack">
      <div className="page-title"><h1>Settings</h1></div>
      <ProfileForm
        name={user.name}
        username={user.username}
        bio={user.bio}
        brandColor={user.brandColor}
        logo={user.logo}
        cover={user.cover}
        baseUrl={appUrl()}
      />

      <div className="card stack" id="calendar">
        <strong>Calendar</strong>
        {sp.calendar === "connected" && <div className="alert alert-ok">Google Calendar connected ✓</div>}
        {sp.calendar === "error" && (
          <div className="alert alert-error">Google didn&apos;t finish connecting. Please try again (see SETUP.md → Troubleshooting).</div>
        )}
        {cal ? (
          <>
            <p>
              Connected{cal.conn.accountEmail ? <> as <strong>{cal.conn.accountEmail}</strong></> : null}
              {cal.conn.provider === "fake" && <span className="badge" style={{ marginLeft: 8 }}>test calendar</span>}
            </p>
            {cal.conn.lastError && <div className="alert alert-warn">Last problem: {cal.conn.lastError}</div>}
            {listError ? (
              <div className="alert alert-error">Couldn&apos;t load your calendars: {listError}. Try disconnecting and connecting again.</div>
            ) : (
              <CalendarChoice calendars={calendars} busy={cal.conn.busyCalendarIds} write={cal.conn.writeCalendarId} />
            )}
            <form action={disconnectCalendar}><button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>Disconnect calendar</button></form>
          </>
        ) : (
          <>
            <p className="muted">
              Connect Google Calendar so busy times are blocked and new bookings land on your calendar.
            </p>
            {googleConfigured() ? (
              <form action="/api/google/connect" method="get"><button className="btn">Connect Google Calendar</button></form>
            ) : (
              <div className="alert alert-warn">
                Google keys aren&apos;t set up yet. Follow SETUP.md, step 6. Your redirect URL is <code>{googleRedirectUri()}</code>
              </div>
            )}
            {fakeCalendarEnabled() && (
              <form action={connectFakeCalendar}><button className="btn btn-secondary btn-sm">Use test calendar</button></form>
            )}
          </>
        )}
        <p className="subtle">Connecting Google also lets event types use <strong>Google Meet</strong> links.</p>
      </div>

      <div className="card stack" id="zoom">
        <strong>Zoom (optional)</strong>
        {sp.zoom === "connected" && <div className="alert alert-ok">Zoom connected ✓</div>}
        {sp.zoom === "error" && (
          <div className="alert alert-error">Zoom didn&apos;t finish connecting. Please try again (see SETUP.md → Zoom).</div>
        )}
        {zoom ? (
          <>
            <p>
              Connected{zoom.accountEmail ? <> as <strong>{zoom.accountEmail}</strong></> : null}. Event types set to “Zoom” now get a
              new meeting for every booking.
            </p>
            {zoom.lastError && <div className="alert alert-warn">Last problem: {zoom.lastError}</div>}
            <form action={disconnectZoom}><button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>Disconnect Zoom</button></form>
          </>
        ) : (
          <>
            <p className="muted">
              Prefer Zoom? Connect your Zoom account and each booking gets its own Zoom meeting with a passcode.
              Without it, the free Jitsi video link works with no account at all.
            </p>
            {zoomConfigured() ? (
              <form action="/api/zoom/connect" method="get"><button className="btn btn-secondary">Connect Zoom</button></form>
            ) : (
              <div className="alert alert-warn">
                Zoom keys aren&apos;t set up yet (optional). See SETUP.md → “Optional: Zoom”. Your redirect URL is <code>{zoomRedirectUri()}</code>
              </div>
            )}
            {fakeCalendarEnabled() && (
              <form action={connectFakeZoom}><button className="btn btn-secondary btn-sm">Use test Zoom</button></form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
