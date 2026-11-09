import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { getMembership, listMembers } from "@/lib/teams";
import { EventForm } from "./EventForm";
import { deleteEventType } from "../../actions";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const et = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.userId, user.id)),
  });
  if (!et) notFound();
  const db = getDb();
  const membership = await getMembership(user.id);
  const isTeamOwner = membership?.role === "owner";
  const members = isTeamOwner ? await listMembers(membership.team.id) : [];
  const [zoomRows, calRows, hostRows] = await Promise.all([
    db.select({ userId: schema.zoomConnections.userId }).from(schema.zoomConnections),
    db.select({ userId: schema.calendarConnections.userId }).from(schema.calendarConnections),
    db.select({ userId: schema.eventTypeHosts.userId }).from(schema.eventTypeHosts).where(eq(schema.eventTypeHosts.eventTypeId, et.id)),
  ]);
  const zoomSet = new Set(zoomRows.map((r) => r.userId));
  const calSet = new Set(calRows.map((r) => r.userId));
  const people = (members.length ? members.map((m) => m.user) : [user]).map((u) => ({
    id: u.id,
    name: u.name || u.email,
    zoom: zoomSet.has(u.id),
    google: calSet.has(u.id),
  }));
  return (
    <div className="stack">
      <div className="page-title">
        <h1>Edit event type</h1>
        <Link href="/admin/events" className="btn btn-ghost btn-sm">← All event types</Link>
      </div>
      <EventForm
        eventType={et}
        baseUrl={`${appUrl()}/${user.username}/`}
        teamBaseUrl={membership ? `${appUrl()}/team/${membership.team.slug}/` : null}
        team={isTeamOwner ? { name: membership.team.name } : null}
        people={people}
        hostIds={hostRows.map((r) => r.userId)}
        me={user.id}
      />
      <form action={deleteEventType} className="card row between">
        <input type="hidden" name="id" value={et.id} />
        <span className="muted small">Deleting also removes its past bookings from your dashboard.</span>
        <button className="btn btn-danger btn-sm">Delete event type</button>
      </form>
    </div>
  );
}
