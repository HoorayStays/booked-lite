import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicEvent, imageUrl } from "@/lib/public";
import { getBookingWithContext } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";
import { brandStyle } from "@/lib/brand";
import { durationLabel } from "@/lib/format";
import { Footer } from "@/components/Footer";
import { ClockIcon } from "@/components/Icons";
import { LocationLine } from "@/components/LocationLine";
import { ProfileHeader } from "@/components/ProfileHeader";
import { BookingWidget } from "./BookingWidget";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ user: string; event: string }>;
  searchParams: Promise<{ reschedule?: string; token?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user, event } = await params;
  const data = await getPublicEvent(user, event);
  if (!data) return { title: "Not found" };
  const host = data.owner.name || data.owner.username;
  return {
    title: `${data.eventType.title} with ${host}`,
    description: data.eventType.description.slice(0, 160) || `Book a ${data.eventType.title} with ${host}.`,
  };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { user, event } = await params;
  const sp = await searchParams;
  const data = await getPublicEvent(user, event);
  if (!data) notFound();
  const { owner, eventType: et } = data;

  let reschedule: { id: string; token: string; start: number } | undefined;
  if (sp.reschedule && sp.token) {
    const ctx = await getBookingWithContext(sp.reschedule);
    if (ctx && ctx.booking.status === "confirmed" && ctx.booking.eventTypeId === et.id && safeEqual(ctx.booking.manageToken, sp.token)) {
      reschedule = { id: ctx.booking.id, token: sp.token, start: ctx.booking.startUtc };
    }
  }

  return (
    <div style={brandStyle(owner.brandColor)}>
      <main>
        <div className={owner.cover ? "cover" : "cover-none"} style={owner.cover ? { backgroundImage: `url(${imageUrl(owner, "cover")})` } : undefined} />
        <div className="container" style={{ maxWidth: 1000, marginTop: -40 }}>
          <div className="card booker">
            <div className="booker-info">
              <ProfileHeader owner={owner} compact />
              <h2 style={{ fontSize: 24, marginTop: 16 }}>{et.title}</h2>
              <div className="meta">
                <div><ClockIcon /><span>{durationLabel(et.durationMin)}</span></div>
                <LocationLine type={et.locationType} value={et.locationType === "in_person" ? et.locationValue : ""} />
              </div>
              {et.description && <p className="desc">{et.description}</p>}
            </div>
            <BookingWidget
              username={owner.username}
              eventSlug={et.slug}
              durationMin={et.durationMin}
              questions={et.questions}
              askPhone={et.locationType === "phone"}
              reschedule={reschedule}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
