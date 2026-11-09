import { getBookingWithContext } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";
import { buildIcs } from "@/lib/ics";
import { locationDisplay } from "@/lib/location";

/** "Add to calendar" download for guests. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ctx = await getBookingWithContext(id);
  if (!ctx || !safeEqual(ctx.booking.manageToken, token)) return new Response("Not found", { status: 404 });
  const { booking: b, eventType: et, owner } = ctx;
  const where = locationDisplay(b.locationType, b.locationValue);
  const ics = buildIcs({
    uid: `${b.id}@booked-lite`,
    sequence: b.sequence,
    start: b.startUtc,
    end: b.endUtc,
    title: `${et.title} with ${owner.name || owner.username}`,
    description: `Where: ${where}`,
    location: where,
    organizer: { name: owner.name || owner.username, email: owner.email },
    attendee: { name: b.guestName, email: b.guestEmail },
    method: b.status === "cancelled" ? "CANCEL" : "REQUEST",
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="booking.ics"`,
    },
  });
}
