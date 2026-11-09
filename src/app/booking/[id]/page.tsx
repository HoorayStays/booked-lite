import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingWithContext } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";
import { formatDateTimeRange, timeZoneLabel } from "@/lib/format";
import { isUrl, locationDisplay } from "@/lib/location";
import { eventPageUrl, hostLabel } from "@/lib/email/templates";
import { ProfileHeader } from "@/components/ProfileHeader";
import { guestEmailMode } from "@/lib/env";
import { PublicShell } from "@/components/public/PublicShell";
import { cancelAsGuest } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

function hasEnded(endUtc: number) {
  return endUtc < Date.now();
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; done?: string; cancel?: string; embed?: string }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token = "", done, cancel, embed } = await searchParams;
  const ctx = await getBookingWithContext(id);
  if (!ctx || !token || !safeEqual(ctx.booking.manageToken, token)) notFound();
  const { booking: b, eventType: et, owner, team } = ctx;
  const where = locationDisplay(b.locationType, b.locationValue);
  const cancelled = b.status === "cancelled";
  const past = hasEnded(b.endUtc);
  const t = encodeURIComponent(token);
  const e = embed === "1" ? "&embed=1" : "";
  const eventUrl = eventPageUrl(et, owner, team).replace(/^https?:\/\/[^/]+/, "");

  return (
    <PublicShell brand={owner} embed={embed === "1"} event={done && !cancelled ? "scheduled" : undefined}>
      <div className="card stack">
        <ProfileHeader owner={owner} title={team?.name} compact />
        {cancelled ? (
          <h1 style={{ fontSize: 24 }}>This booking is cancelled</h1>
        ) : (
          <h1 style={{ fontSize: 24 }} data-testid="booking-heading">
            {done ? "You're booked! 🎉" : "Your booking"}
          </h1>
        )}
        {done && !cancelled &&
          (guestEmailMode() === "send" ? (
            <p className="muted">A confirmation email with a calendar invite is on its way to {b.guestEmail}.</p>
          ) : (
            <div className="alert alert-warn" data-testid="save-this-page">
              <strong>Save this page.</strong> {hostLabel(ctx)} has your booking, but email confirmations aren&apos;t switched on
              yet. Tap <strong>Add to calendar</strong> below, and bookmark this page to reschedule or cancel later.
            </div>
          ))}
        <div className="stack-sm">
          <div className="subtle">What</div>
          <div><strong>{et.title}</strong> with {hostLabel(ctx)}</div>
          <div className="subtle mt">When</div>
          <div data-testid="booking-when" style={cancelled ? { textDecoration: "line-through" } : undefined}>
            {formatDateTimeRange(b.startUtc, b.endUtc, b.guestTimezone)}
            <div className="subtle">{timeZoneLabel(b.guestTimezone)}</div>
          </div>
          {!cancelled && (
            <>
              <div className="subtle mt">Where</div>
              <div style={{ wordBreak: "break-word" }} data-testid="booking-where">
                {isUrl(where) ? <a href={where} target="_blank" rel="noopener">{where}</a> : where}
                {b.meetingPassword && <div className="subtle">Passcode: <strong>{b.meetingPassword}</strong></div>}
              </div>
            </>
          )}
        </div>

        {!cancelled && !past && (
          <>
            <div className="row">
              <a className="btn btn-secondary" href={`/api/bookings/${b.id}/ics?token=${t}`}>Add to calendar</a>
              <Link className="btn btn-secondary" href={`${eventUrl}?reschedule=${b.id}&token=${t}${e}`}>Reschedule</Link>
              {!cancel && <Link className="btn btn-danger" href={`/booking/${b.id}?token=${t}&cancel=1${e}`}>Cancel</Link>}
            </div>
            {cancel && (
              <form action={cancelAsGuest} className="stack-sm card" style={{ boxShadow: "none" }}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="embed" value={embed === "1" ? "1" : ""} />
                <label htmlFor="reason">Cancel this booking? You can leave a note (optional).</label>
                <textarea id="reason" name="reason" maxLength={500} />
                <div className="row">
                  <button className="btn btn-danger" type="submit">Yes, cancel booking</button>
                  <Link className="btn btn-ghost" href={`/booking/${b.id}?token=${t}${e}`}>Keep it</Link>
                </div>
              </form>
            )}
          </>
        )}
        {cancelled && <Link className="btn" href={`${eventUrl}${e ? "?embed=1" : ""}`}>Book a new time</Link>}
      </div>
    </PublicShell>
  );
}
