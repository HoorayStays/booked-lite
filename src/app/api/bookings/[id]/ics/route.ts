import { bookingIcs, getBookingWithContext } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";

/** "Add to calendar" download for guests. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ctx = await getBookingWithContext(id);
  if (!ctx || !safeEqual(ctx.booking.manageToken, token)) return new Response("Not found", { status: 404 });
  return new Response(bookingIcs(ctx), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="booking.ics"`,
    },
  });
}
