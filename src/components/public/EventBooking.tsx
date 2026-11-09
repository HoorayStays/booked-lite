import { getBookingWithContext } from "@/lib/bookings";
import { safeEqual } from "@/lib/crypto";
import { durationLabel } from "@/lib/format";
import type { PublicEvent } from "@/lib/public";
import { getEventHosts } from "@/lib/teams";
import { ClockIcon, UsersIcon } from "@/components/Icons";
import { LocationLine } from "@/components/LocationLine";
import { ProfileHeader } from "@/components/ProfileHeader";
import { BookingWidget } from "./BookingWidget";
import { PublicShell } from "./PublicShell";

export type BookingSearch = { reschedule?: string; token?: string; embed?: string };

/** The booking page for one event type (personal or team). */
export async function EventBooking({ data, sp }: { data: PublicEvent; sp: BookingSearch }) {
  const { owner, eventType: et, team } = data;
  const embed = sp.embed === "1";

  let reschedule: { id: string; token: string; start: number } | undefined;
  if (sp.reschedule && sp.token) {
    const ctx = await getBookingWithContext(sp.reschedule);
    if (ctx && ctx.booking.status === "confirmed" && ctx.booking.eventTypeId === et.id && safeEqual(ctx.booking.manageToken, sp.token)) {
      reschedule = { id: ctx.booking.id, token: sp.token, start: ctx.booking.startUtc };
    }
  }
  const hosts = team ? await getEventHosts(et) : [];

  return (
    <PublicShell brand={owner} embed={embed} wide>
      <div className="card booker">
        <div className="booker-info">
          <ProfileHeader owner={owner} title={team?.name} compact />
          <h2 style={{ fontSize: 24, marginTop: 16 }}>{et.title}</h2>
          <div className="meta">
            <div><ClockIcon /><span>{durationLabel(et.durationMin)}</span></div>
            <LocationLine type={et.locationType} value={et.locationType === "in_person" ? et.locationValue : ""} />
            {team && hosts.length > 0 && (
              <div>
                <UsersIcon />
                <span>
                  {et.schedulingType === "collective"
                    ? `With ${hosts.map((h) => h.name || h.username).join(", ")}`
                    : `With one of: ${hosts.map((h) => h.name || h.username).join(", ")}`}
                </span>
              </div>
            )}
          </div>
          {et.description && <p className="desc">{et.description}</p>}
        </div>
        <BookingWidget
          eventId={et.id}
          embed={embed}
          durationMin={et.durationMin}
          questions={et.questions}
          askPhone={et.locationType === "phone"}
          reschedule={reschedule}
        />
      </div>
    </PublicShell>
  );
}
