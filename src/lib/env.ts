/**
 * All configuration comes from environment variables (see .env.example).
 * Secrets live in Vercel → Settings → Environment Variables, never in the code.
 */

const isProd = process.env.NODE_ENV === "production";

export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

export function authSecret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (isProd && !process.env.E2E) {
    throw new Error("AUTH_SECRET is missing or too short. Add a long random value in your environment variables.");
  }
  return "dev-only-secret-do-not-use-in-production";
}

/** Emails allowed to sign in to the admin area (comma separated). */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Can we email guests? Resend only delivers to OTHER people once you send from a domain you verified.
 * "onboarding@resend.dev" (no domain yet) can only reach the Resend account owner.
 */
export function guestEmailMode(): "send" | "forward-to-host" | "log" {
  if (!emailConfigured()) return "log"; // no Resend key: everything is printed to the server log
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  return from && !/@resend\.dev>?$/i.test(from) ? "send" : "forward-to-host";
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "B👀KED Lite <onboarding@resend.dev>";
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function zoomConfigured(): boolean {
  return Boolean(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

/** Test-only: use a fake calendar stored in a local JSON file instead of Google. */
export function fakeCalendarEnabled(): boolean {
  return process.env.CALENDAR_PROVIDER === "fake";
}

export function isDevMode(): boolean {
  return !isProd;
}
