import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { durationLabel } from "@/lib/format";
import { LOCATION_LABELS } from "@/lib/location";
import { createEventType, toggleEventType } from "../actions";

export default async function EventsPage() {
  const user = await requireUser();
  const events = await getDb()
    .select()
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.userId, user.id))
    .orderBy(asc(schema.eventTypes.position), asc(schema.eventTypes.createdAt));
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
              </div>
              <span className="subtle">
                {durationLabel(e.durationMin)} · {LOCATION_LABELS[e.locationType]} · /{user.username}/{e.slug}
              </span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <form action={toggleEventType}>
                <input type="hidden" name="id" value={e.id} />
                <button className="btn btn-secondary btn-sm">{e.active ? "Turn off" : "Turn on"}</button>
              </form>
              <Link className="btn btn-secondary btn-sm" href={`/admin/events/${e.id}`}>Edit</Link>
              {e.active && <Link className="btn btn-ghost btn-sm" href={`/${user.username}/${e.slug}`} target="_blank">Preview ↗</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
