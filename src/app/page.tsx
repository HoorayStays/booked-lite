import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Wordmark } from "@/components/Wordmark";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <>
      <main className="container narrow" style={{ paddingTop: 64 }}>
        <div className="card stack center">
          <div><Wordmark /></div>
          <h1 style={{ fontSize: 28 }}>Your own free booking page</h1>
          <p className="muted">
            Let guests, owners and partners book time with you. It syncs with Google Calendar, sends
            email reminders, and creates video links automatically.
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            {user ? (
              <>
                <Link className="btn" href="/admin">Open my dashboard</Link>
                <Link className="btn btn-secondary" href={`/${user.username}`}>View my booking page</Link>
              </>
            ) : (
              <Link className="btn" href="/login">Host sign in</Link>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
