import { NextResponse } from "next/server";
import { getEventById } from "@/lib/public";
import { getAvailableSlots } from "@/lib/bookings";

const MAX_RANGE = 45 * 86_400_000;

/** GET /api/slots?event=<eventTypeId>&from=<ms>&to=<ms>[&ignore=<bookingId>] */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > MAX_RANGE) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const found = await getEventById(url.searchParams.get("event") ?? "");
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const slots = await getAvailableSlots(found.eventType, from, to, {
    ignoreBookingId: url.searchParams.get("ignore") ?? undefined,
  });
  return NextResponse.json({ slots }, { headers: { "cache-control": "no-store" } });
}
