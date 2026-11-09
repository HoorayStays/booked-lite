import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { durationLabel } from "@/lib/format";
import { LOCATION_LABELS } from "@/lib/location";
import { getMembership } from "@/lib/teams";
import { createEventType, toggleEventType } from "../actions";

export default async function EventsPage() {
  const user = await requireUser();
  const events = await getDb()
    .select()
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.userId, user.id))
    .orderBy(asc(schema.eventTypes.position), asc(schema.eventTypes.createdAt));
  const membership = await getMembership(user.id);
  // Teammates see the team events they host (read-only; the owner edits them).
  const hostedIds = (
    await getDb().select({ id: schema.eventTypeHosts.eventTypeId }).from(schema.eventTypeHosts).where(eq(schema.eventTypeHosts.userId, user.id))
  ).map((r) => r.id);
  const hostedTeamEvents = hostedIds.length
    ? (await getDb().select().from(schema.eventTypes).where(inArray(schema.eventTypes.id, hostedIds))).filter((e) => e.userId !== user.id)
    : [];
  const pathFor = (e: (typeof events)[number]) => (e.teamId && membership ? `/team/${membership.team.slug}/${e.slug}` : `/${user.username}/${e.slug}`);
  return (
    <div className="stack">
      <div className="page-title">
        <h1>Event types</h1>
        <form action={createEventType}><button className="btn">+ New event type</button></form>
      </div>
      <div className="card list">
        {events.length === 0 && <p className="muted">No event types yet. Create your first one.</p>}
        {events.map((e) => (
          <div key={e.id} className="list-item">
            <div className="stack-sm" style={{ gap: 2 }}>
              <div className="row" style={{ gap: 8 }}>
                <Link href={`/admin/events/${e.id}`}><strong>{e.title}</strong></Link>
                {e.active ? <span className="badge badge-brand">On</span> : <span className="badge">Off</span>}
                {e.teamId && <span className="badge">{e.schedulingType === "collective" ? "Team · everyone" : "Team · round robin"}</span>}
              </div>
              <span className="subtle">
                {durationLabel(e.durationMin)} · {LOCATION_LABELS[e.locationType]} · {pathFor(e)}
              </span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <form action={toggleEventType}>
                <input type="hidden" name="id" value={e.id} />
                <button className="btn btn-secondary btn-sm">{e.active ? "Turn off" : "Turn on"}</button>
              </form>
              <Link className="btn btn-secondary btn-sm" href={`/admin/events/${e.id}`}>Edit</Link>
              {e.active && <Link className="btn btn-ghost btn-sm" href={pathFor(e)} target="_blank">Preview ↗</Link>}
            </div>
          </div>
        ))}
      </div>
      {hostedTeamEvents.length > 0 && (
        <div className="card stack-sm">
          <strong>Team events you host</strong>
          <p className="subtle">Your team owner manages these. Bookings use your availability and calendar.</p>
          {hostedTeamEvents.map((e) => (
            <div key={e.id} className="row between">
              <span>{e.title} <span className="subtle">· {durationLabel(e.durationMin)}</span></span>
              {e.active && membership && (
                <Link className="btn btn-ghost btn-sm" href={`/team/${membership.team.slug}/${e.slug}`} target="_blank">Preview ↗</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
