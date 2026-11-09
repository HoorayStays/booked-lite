import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { confirmLink } from "../actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * The emailed link lands here and the person taps a button to finish signing in.
 * (Email security scanners open links automatically; requiring a tap stops them using up the link.)
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="container narrow" style={{ paddingTop: 64, maxWidth: 440 }}>
      <form action={confirmLink} className="card stack">
        <Wordmark />
        <h1 style={{ fontSize: 22 }}>Almost there</h1>
        <input type="hidden" name="token" value={token} />
        <button className="btn btn-block" type="submit">Continue to my dashboard</button>
      </form>
    </main>
  );
}
