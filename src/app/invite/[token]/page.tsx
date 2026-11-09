import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { findInvite, acceptInvite } from "@/lib/teams";
import { createSession } from "@/lib/auth";
import { Wordmark } from "@/components/Wordmark";
import { Footer } from "@/components/Footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join team", robots: { index: false } };

async function accept(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const user = await acceptInvite(token);
  if (!user) redirect("/login?expired=1");
  await createSession(user.id);
  redirect("/admin?welcome=1");
}

/** Teammates land here from their invite email and tap a button to join (scanners can't accept for them). */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findInvite(token);
  return (
    <>
      <main className="container narrow" style={{ paddingTop: 64, maxWidth: 460 }}>
        <div className="card stack">
          <Wordmark />
          {found ? (
            <form action={accept} className="stack">
              <h1 style={{ fontSize: 22 }}>Join {found.team.name}</h1>
              <p className="muted">
                You&apos;ll get your own booking page, connect your own calendar, and can be booked for the team&apos;s events.
                Signing in as <strong>{found.invite.email}</strong>.
              </p>
              <input type="hidden" name="token" value={token} />
              <button className="btn btn-block" type="submit">Accept &amp; continue</button>
            </form>
          ) : (
            <>
              <h1 style={{ fontSize: 22 }}>This invite has expired</h1>
              <p className="muted">Invites work once and last 7 days. Ask your team owner to send a new one.</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
