import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { listBookings } from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { appUrl, emailConfigured, googleConfigured, guestEmailMode } from "@/lib/env";
import { formatDateTimeRange } from "@/lib/format";
import { isUrl, locationDisplay } from "@/lib/location";
import { CopyLink } from "@/components/CopyLink";
import { cancelAsOwner } from "./actions";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; welcome?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "past" ? "past" : "upcoming";
  const db = getDb();
  const [rows, conn, events] = await Promise.all([
    listBookings(user.id, view),
    db.query.calendarConnections.findFirst({ where: eq(schema.calendarConnections.userId, user.id) }),
    db.select({ id: schema.eventTypes.id, active: schema.eventTypes.active }).from(schema.eventTypes).where(eq(schema.eventTypes.userId, user.id)),
  ]);
  const steps = [
    { done: Boolean(user.name), label: "Add your name and brand", href: "/admin/settings" },
    { done: Boolean(conn), label: "Connect your Google Calendar", href: "/admin/settings" },
    { done: events.some((e) => e.active), label: "Turn on at least one event type", href: "/admin/events" },
    { done: emailConfigured(), label: "Set up email (Resend). See SETUP.md, step 3", href: undefined },
    {
      done: guestEmailMode() === "send",
      label: "Verify your email domain so guests get emails (until then you get a copy to forward). SETUP.md → “No domain yet?”",
      href: undefined,
    },
  ];
  const todo = steps.filter((s) => !s.done);
  const pageUrl = `${appUrl()}/${user.username}`;

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Bookings</h1>
      </div>
      {sp.welcome && (
        <div className="alert alert-ok">
          Welcome to the team! 🎉 Next: set your name in <Link href="/admin/settings">Settings</Link>, connect your calendar there, and check your{" "}
          <Link href="/admin/availability">Availability</Link>.
        </div>
      )}

      <div className="card stack-sm">
        <strong>Your booking page</strong>
        <CopyLink url={pageUrl} />
        <p className="subtle">Share this link with guests, owners and partners, or put it in your email signature.</p>
      </div>

      {todo.length > 0 && (
        <div className="card stack-sm" data-testid="setup-checklist">
          <strong>Finish setting up ({steps.length - todo.length}/{steps.length})</strong>
          {steps.map((s) => (
            <div key={s.label} className="row" style={{ gap: 8 }}>
              <span aria-hidden>{s.done ? "✅" : "⬜️"}</span>
              {s.href && !s.done ? <Link href={s.href}>{s.label}</Link> : <span className={s.done ? "subtle" : undefined}>{s.label}</span>}
            </div>
          ))}
          {!googleConfigured() && !conn && (
            <p className="subtle">Google sign-in keys aren&apos;t added yet. Follow SETUP.md, step 6.</p>
          )}
        </div>
      )}

      {conn?.lastError && (
        <div className="alert alert-warn">
          We had trouble reaching your calendar: {conn.lastError}. <Link href="/admin/settings">Reconnect it</Link> so busy times stay blocked.
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <Link className={`btn btn-sm ${view === "upcoming" ? "" : "btn-secondary"}`} href="/admin">Upcoming</Link>
          <Link className={`btn btn-sm ${view === "past" ? "" : "btn-secondary"}`} href="/admin?view=past">Past</Link>
        </div>
        <div className="list" data-testid="bookings-list">
          {rows.length === 0 && <p className="muted" style={{ padding: "16px 0" }}>No {view} bookings yet.</p>}
          {rows.map(({ booking: b, eventTitle, questions, hosts }) => {
            const where = locationDisplay(b.locationType, b.locationValue);
            return (
              <div key={b.id} className="list-item">
                <div className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{formatDateTimeRange(b.startUtc, b.endUtc, user.timezone)}</strong>
                  <span>
                    {eventTitle} · {b.guestName} <span className="subtle">&lt;{b.guestEmail}&gt;</span>
                  </span>
                  {(hosts.length > 1 || b.userId !== user.id) && <span className="small">Host: {hosts.join(", ")}</span>}
                  <span className="subtle" style={{ wordBreak: "break-all" }}>
                    {isUrl(where) ? <a href={where} target="_blank" rel="noopener">{where}</a> : where}
                    {b.meetingPassword && <> · passcode {b.meetingPassword}</>}
                  </span>
                  {Object.keys(b.answers).length > 0 && (
                    <details className="small">
                      <summary>Answers</summary>
                      {Object.entries(b.answers).map(([k, v]) => (
                        <div key={k} className="muted" style={{ whiteSpace: "pre-line" }}>
                          <strong>{questions.find((q) => q.id === k)?.label ?? "Answer"}:</strong> {v}
                        </div>
                      ))}
                    </details>
                  )}
                </div>
                {b.status === "cancelled" ? (
                  <span className="badge badge-danger">Cancelled</span>
                ) : view === "upcoming" ? (
                  <details>
                    <summary className="btn btn-danger btn-sm">Cancel</summary>
                    <form action={cancelAsOwner} className="stack-sm" style={{ marginTop: 8, maxWidth: 320 }}>
                      <input type="hidden" name="id" value={b.id} />
                      <label htmlFor={`r-${b.id}`} className="small">Note to guest (optional)</label>
                      <textarea id={`r-${b.id}`} name="reason" maxLength={500} />
                      <button className="btn btn-danger btn-sm" type="submit">Cancel &amp; email guest</button>
                    </form>
                  </details>
                ) : (
                  <span className="badge">Done</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
