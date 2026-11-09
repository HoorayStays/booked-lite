import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { encrypt, safeEqual } from "@/lib/crypto";
import { getDb, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { exchangeZoomCode, zoomUserEmail } from "@/lib/zoom";

/** Zoom sends the person back here after they click "Allow". */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(`${appUrl()}/admin/settings?zoom=${status}#zoom`);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`);

  const jar = await cookies();
  const expected = jar.get("zoom_oauth_state")?.value ?? "";
  jar.delete("zoom_oauth_state");
  const code = url.searchParams.get("code");
  if (!code || !expected || !safeEqual(url.searchParams.get("state") ?? "", expected)) return back("error");

  try {
    const t = await exchangeZoomCode(code);
    const values = {
      accountEmail: await zoomUserEmail(t.access_token),
      refreshTokenEnc: encrypt(t.refresh_token),
      accessTokenEnc: encrypt(t.access_token),
      accessTokenExpiresAt: Date.now() + t.expires_in * 1000,
      lastError: null,
      updatedAt: Date.now(),
    };
    await getDb()
      .insert(schema.zoomConnections)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({ target: schema.zoomConnections.userId, set: values });
    return back("connected");
  } catch (err) {
    console.error("[zoom] connect failed", err);
    return back("error");
  }
}
