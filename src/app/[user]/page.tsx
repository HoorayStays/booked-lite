import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile, imageUrl } from "@/lib/public";
import { brandStyle } from "@/lib/brand";
import { durationLabel } from "@/lib/format";
import { Footer } from "@/components/Footer";
import { ClockIcon } from "@/components/Icons";
import { ProfileHeader } from "@/components/ProfileHeader";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ user: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicProfile((await params).user);
  if (!data) return { title: "Not found" };
  return { title: `Book time with ${data.owner.name || data.owner.username}` };
}

export default async function ProfilePage({ params }: Props) {
  const data = await getPublicProfile((await params).user);
  if (!data) notFound();
  const { owner, events } = data;
  return (
    <div style={brandStyle(owner.brandColor)}>
      <main>
        <div className={owner.cover ? "cover" : "cover-none"} style={owner.cover ? { backgroundImage: `url(${imageUrl(owner, "cover")})` } : undefined} />
        <div className="container narrow">
          <ProfileHeader owner={owner} />
          {owner.bio && <p className="muted mt" style={{ whiteSpace: "pre-line" }}>{owner.bio}</p>}
          <div className="event-list mt-lg">
            {events.length === 0 && <p className="muted">No booking types are available right now.</p>}
            {events.map((e) => (
              <Link key={e.id} href={`/${owner.username}/${e.slug}`} className="card event-link">
                <div className="stack-sm">
                  <h2 style={{ fontSize: 18 }}>{e.title}</h2>
                  {e.description && <p className="muted small">{e.description.split("\n")[0]}</p>}
                </div>
                <span className="badge badge-brand row" style={{ gap: 4, whiteSpace: "nowrap" }}>
                  <ClockIcon /> {durationLabel(e.durationMin)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
