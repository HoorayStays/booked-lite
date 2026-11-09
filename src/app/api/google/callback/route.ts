import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { encrypt, safeEqual } from "@/lib/crypto";
import { getDb, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { emailFromIdToken, exchangeCode } from "@/lib/calendar/google";

/** Google sends the host back here after they click "Allow". */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(`${appUrl()}/admin/settings?calendar=${status}#calendar`);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`);

  const jar = await cookies();
  const expected = jar.get("google_oauth_state")?.value ?? "";
  jar.delete("google_oauth_state");
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!code || !expected || !safeEqual(state, expected)) return back("error");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      console.error("[google] No refresh token returned. Remove the app's access at myaccount.google.com/permissions and try again.");
      return back("error");
    }
    const values = {
      provider: "google" as const,
      accountEmail: emailFromIdToken(tokens.id_token),
      refreshTokenEnc: encrypt(tokens.refresh_token),
      accessTokenEnc: encrypt(tokens.access_token),
      accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      lastError: null,
      updatedAt: Date.now(),
    };
    await getDb()
      .insert(schema.calendarConnections)
      .values({ userId: user.id, busyCalendarIds: ["primary"], writeCalendarId: "primary", ...values })
      .onConflictDoUpdate({ target: schema.calendarConnections.userId, set: values });
    return back("connected");
  } catch (err) {
    console.error("[google] connect failed", err);
    return back("error");
  }
}
