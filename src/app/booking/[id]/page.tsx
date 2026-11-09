import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingWithContext } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";
import { brandStyle } from "@/lib/brand";
import { formatDateTimeRange, timeZoneLabel } from "@/lib/format";
import { isUrl, locationDisplay } from "@/lib/location";
import { Footer } from "@/components/Footer";
import { ProfileHeader } from "@/components/ProfileHeader";
import { cancelAsGuest } from "./actions";

function hasEnded(endUtc: number) {
  return endUtc < Date.now();
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; done?: string; cancel?: string }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token = "", done, cancel } = await searchParams;
  const ctx = await getBookingWithContext(id);
  if (!ctx || !token || !safeEqual(ctx.booking.manageToken, token)) notFound();
  const { booking: b, eventType: et, owner } = ctx;
  const where = locationDisplay(b.locationType, b.locationValue);
  const cancelled = b.status === "cancelled";
  const past = hasEnded(b.endUtc);
  const t = encodeURIComponent(token);

  return (
    <div style={brandStyle(owner.brandColor)}>
      <main className="container narrow" style={{ paddingTop: 40 }}>
        <div className="card stack">
          <ProfileHeader owner={owner} compact />
          {cancelled ? (
            <h1 style={{ fontSize: 24 }}>This booking is cancelled</h1>
          ) : (
            <h1 style={{ fontSize: 24 }} data-testid="booking-heading">
              {done ? "You're booked! 🎉" : "Your booking"}
            </h1>
          )}
          {done && !cancelled && (
            <p className="muted">A confirmation email with a calendar invite is on its way to {b.guestEmail}.</p>
          )}
          <div className="stack-sm">
            <div className="subtle">What</div>
            <div><strong>{et.title}</strong> with {owner.name || owner.username}</div>
            <div className="subtle mt">When</div>
            <div data-testid="booking-when" style={cancelled ? { textDecoration: "line-through" } : undefined}>
              {formatDateTimeRange(b.startUtc, b.endUtc, b.guestTimezone)}
              <div className="subtle">{timeZoneLabel(b.guestTimezone)}</div>
            </div>
            {!cancelled && (
              <>
                <div className="subtle mt">Where</div>
                <div style={{ wordBreak: "break-word" }}>
                  {isUrl(where) ? <a href={where} target="_blank" rel="noopener">{where}</a> : where}
                </div>
              </>
            )}
          </div>

          {!cancelled && !past && (
            <>
              <div className="row">
                <a className="btn btn-secondary" href={`/api/bookings/${b.id}/ics?token=${t}`}>Add to calendar</a>
                <Link className="btn btn-secondary" href={`/${owner.username}/${et.slug}?reschedule=${b.id}&token=${t}`}>Reschedule</Link>
                {!cancel && <Link className="btn btn-danger" href={`/booking/${b.id}?token=${t}&cancel=1`}>Cancel</Link>}
              </div>
              {cancel && (
                <form action={cancelAsGuest} className="stack-sm card" style={{ boxShadow: "none" }}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="token" value={token} />
                  <label htmlFor="reason">Cancel this booking? You can leave a note (optional).</label>
                  <textarea id="reason" name="reason" maxLength={500} />
                  <div className="row">
                    <button className="btn btn-danger" type="submit">Yes, cancel booking</button>
                    <Link className="btn btn-ghost" href={`/booking/${b.id}?token=${t}`}>Keep it</Link>
                  </div>
                </form>
              )}
            </>
          )}
          {cancelled && (
            <Link className="btn" href={`/${owner.username}/${et.slug}`}>Book a new time</Link>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
