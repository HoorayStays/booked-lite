import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { brandStyle } from "@/lib/brand";
import { Footer } from "@/components/Footer";
import { Wordmark } from "@/components/Wordmark";
import { logout } from "../login/actions";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div style={brandStyle(user.brandColor)} className="stack" >
      <header className="topbar">
        <div className="container topbar-inner">
          <Wordmark href="/admin" />
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn btn-secondary btn-sm" href={`/${user.username}`} target="_blank">View my page</Link>
            <form action={logout}><button className="btn btn-ghost btn-sm">Sign out</button></form>
          </div>
        </div>
        <div className="container" style={{ paddingBottom: 8 }}><AdminNav /></div>
      </header>
      <main className="container" style={{ paddingBottom: 24 }}>{children}</main>
      <Footer />
    </div>
  );
}
