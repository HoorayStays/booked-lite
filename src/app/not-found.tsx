import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <main className="container narrow" style={{ paddingTop: 64 }}>
        <div className="card stack center">
          <h1 style={{ fontSize: 24 }}>Page not found</h1>
          <p className="muted">This booking link may have changed. Please check with the person who sent it.</p>
          <div><Link className="btn btn-secondary" href="/">Go home</Link></div>
        </div>
      </main>
      <Footer />
    </>
  );
}
