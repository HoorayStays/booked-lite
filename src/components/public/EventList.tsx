import Link from "next/link";
import type { EventType } from "@/lib/db/schema";
import { durationLabel } from "@/lib/format";
import { ClockIcon } from "@/components/Icons";

export function EventList({ events, basePath, embed }: { events: EventType[]; basePath: string; embed: boolean }) {
  return (
    <div className="event-list mt">
      {events.length === 0 && <p className="muted">No booking types are available right now.</p>}
      {events.map((e) => (
        <Link key={e.id} href={`${basePath}/${e.slug}${embed ? "?embed=1" : ""}`} className="card event-link">
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
  );
}
