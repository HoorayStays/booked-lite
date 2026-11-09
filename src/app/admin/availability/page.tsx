import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_WEEKLY } from "@/lib/types";
import { AvailabilityForm } from "./AvailabilityForm";

export default async function AvailabilityPage() {
  const user = await requireUser();
  const row = await getDb().query.availability.findFirst({ where: eq(schema.availability.userId, user.id) });
  return (
    <div className="stack">
      <div className="page-title">
        <h1>Availability</h1>
      </div>
      <p className="muted">
        Set the hours people can book you. Busy times in your connected Google Calendar are blocked automatically.
      </p>
      <AvailabilityForm timezone={user.timezone} weekly={row?.weekly ?? DEFAULT_WEEKLY} overrides={row?.overrides ?? []} />
    </div>
  );
}
