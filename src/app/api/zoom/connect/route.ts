import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { appUrl, zoomConfigured } from "@/lib/env";
import { zoomAuthUrl } from "@/lib/zoom";

/** Starts "Connect Zoom": sends the person to Zoom's approval screen. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`);
  if (!zoomConfigured()) return NextResponse.redirect(`${appUrl()}/admin/settings?zoom=error#zoom`);
  const state = randomToken(16);
  (await cookies()).set("zoom_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(zoomAuthUrl(state));
}
