import { requireUser } from "@/lib/auth";
import { getCalendar } from "@/lib/calendar";
import type { CalendarInfo } from "@/lib/calendar/types";
import { appUrl, fakeCalendarEnabled, googleConfigured } from "@/lib/env";
import { googleRedirectUri } from "@/lib/calendar/google";
import { connectFakeCalendar, disconnectCalendar } from "../actions";
import { ProfileForm } from "./ProfileForm";
import { CalendarChoice } from "./CalendarChoice";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
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

  return (
    <div className="stack">
      <div className="page-title"><h1>Branding &amp; calendar</h1></div>
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
      </div>
    </div>
  );
}
