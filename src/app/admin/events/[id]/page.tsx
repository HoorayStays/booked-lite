import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { EventForm } from "./EventForm";
import { deleteEventType } from "../../actions";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const et = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.userId, user.id)),
  });
  if (!et) notFound();
  return (
    <div className="stack">
      <div className="page-title">
        <h1>Edit event type</h1>
        <Link href="/admin/events" className="btn btn-ghost btn-sm">← All event types</Link>
      </div>
      <EventForm eventType={et} baseUrl={`${appUrl()}/${user.username}/`} />
      <form action={deleteEventType} className="card row between">
        <input type="hidden" name="id" value={et.id} />
        <span className="muted small">Deleting also removes its past bookings from your dashboard.</span>
        <button className="btn btn-danger btn-sm">Delete event type</button>
      </form>
    </div>
  );
}
