import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventById } from "@/lib/public";
import { BookingError, createBooking } from "@/lib/bookings";
import { isValidTimeZone } from "@/lib/format";

const Body = z.object({
  event: z.string().min(1).max(80),
  start: z.number().int().positive(),
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.email("Please enter a valid email").max(200),
  timezone: z.string().max(80),
  phone: z.string().trim().max(40).optional(),
  answers: z.record(z.string(), z.string().max(2000)).default({}),
  website: z.string().optional(), // honeypot: real people never fill this in
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;
  if (body.website) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const found = await getEventById(body.event);
  if (!found) return NextResponse.json({ error: "This booking page no longer exists." }, { status: 404 });
  const { owner, eventType } = found;

  const answers: Record<string, string> = {};
  for (const q of eventType.questions) {
    const a = (body.answers[q.id] ?? "").trim();
    if (q.required && !a) return NextResponse.json({ error: `Please answer: ${q.label}` }, { status: 400 });
    if (a) answers[q.id] = a;
  }
  if (eventType.locationType === "phone" && !body.phone) {
    return NextResponse.json({ error: "Please enter your phone number" }, { status: 400 });
  }

  try {
    const booking = await createBooking(eventType, {
      start: body.start,
      name: body.name,
      email: body.email.toLowerCase(),
      timezone: isValidTimeZone(body.timezone) ? body.timezone : owner.timezone,
      answers,
      guestPhone: body.phone,
    });
    return NextResponse.json({ id: booking.id, token: booking.manageToken });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
