import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { allowedEmails } from "@/lib/env";
import { Footer } from "@/components/Footer";
import { Wordmark } from "@/components/Wordmark";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const { expired } = await searchParams;
  return (
    <>
      <main className="container narrow" style={{ paddingTop: 64, maxWidth: 440 }}>
        <div className="card stack">
          <Wordmark />
          <h1 style={{ fontSize: 22 }}>Host sign in</h1>
          <p className="muted small">No password needed. We&apos;ll email you a one-time link.</p>
          {expired && <div className="alert alert-warn">That link has expired or was already used. Please ask for a new one.</div>}
          {allowedEmails().length === 0 && (
            <div className="alert alert-warn">
              Setup needed: add your email to <code>ALLOWED_EMAILS</code> in your environment variables (see SETUP.md).
            </div>
          )}
          <LoginForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
