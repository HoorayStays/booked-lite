import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { appUrl, googleConfigured } from "@/lib/env";
import { googleAuthUrl } from "@/lib/calendar/google";

/** Starts "Connect Google Calendar": sends the host to Google's consent screen. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${appUrl()}/admin/settings?calendar=error`);
  const state = randomToken(16);
  (await cookies()).set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
