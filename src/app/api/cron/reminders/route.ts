import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";

/**
 * Sends reminder emails. Vercel Cron calls this once a day on the free plan
 * (see vercel.json); .github/workflows/reminders.yml can call it every hour.
 * Protected by CRON_SECRET (Vercel sends it automatically as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendDueReminders();
  return NextResponse.json(result);
}
