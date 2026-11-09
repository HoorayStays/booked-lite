import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { allowedEmails, appUrl, emailConfigured, emailFrom, googleConfigured, zoomConfigured } from "@/lib/env";
import { googleRedirectUri } from "@/lib/calendar/google";
import { zoomRedirectUri } from "@/lib/zoom";

export const dynamic = "force-dynamic";

/**
 * Setup checker: shows WHICH settings are filled in (yes/no), never their values.
 * Claude uses this during setup: open https://<your-app>/api/health
 */
export async function GET() {
  let database = false;
  let databaseError: string | undefined;
  try {
    await getDb().run(sql`select count(*) from users`);
    database = true;
  } catch (err) {
    databaseError = err instanceof Error ? err.message.slice(0, 200) : "unknown error";
  }
  const from = emailFrom();
  const checks = {
    database,
    authSecret: (process.env.AUTH_SECRET?.trim().length ?? 0) >= 16,
    allowedEmails: allowedEmails().length > 0,
    email: emailConfigured(),
    emailFromCustomDomain: emailConfigured() && !from.includes("resend.dev"),
    google: googleConfigured(),
    cronSecret: Boolean(process.env.CRON_SECRET),
    zoom: zoomConfigured(), // optional
  };
  return NextResponse.json(
    {
      ok: checks.database && checks.authSecret && checks.allowedEmails,
      checks,
      ...(databaseError ? { databaseError } : {}),
      appUrl: appUrl(),
      googleRedirectUri: googleRedirectUri(),
      zoomRedirectUri: zoomRedirectUri(),
      embedScript: `${appUrl()}/embed.js`,
      testCalendar: process.env.CALENDAR_PROVIDER === "fake",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
