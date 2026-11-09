import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError, getBookingWithContext, rescheduleBooking } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";

const Body = z.object({ token: z.string().min(10), start: z.number().int().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const ctx = await getBookingWithContext(id);
  if (!ctx || !safeEqual(ctx.booking.manageToken, parsed.data.token)) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  try {
    const updated = await rescheduleBooking(ctx, parsed.data.start);
    return NextResponse.json({ id: updated.id, token: updated.manageToken });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
