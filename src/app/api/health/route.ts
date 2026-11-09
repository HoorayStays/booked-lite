import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { allowedEmails, appUrl, emailConfigured, emailFrom, googleConfigured } from "@/lib/env";
import { googleRedirectUri } from "@/lib/calendar/google";

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
  };
  return NextResponse.json(
    {
      ok: checks.database && checks.authSecret && checks.allowedEmails,
      checks,
      ...(databaseError ? { databaseError } : {}),
      appUrl: appUrl(),
      googleRedirectUri: googleRedirectUri(),
      testCalendar: process.env.CALENDAR_PROVIDER === "fake",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
