import type { EventType, User } from "@/lib/db/schema";
import { ProfileHeader } from "@/components/ProfileHeader";
import { EventList } from "./EventList";
import { PublicShell } from "./PublicShell";

export function ProfileView(props: { brand: User; title?: string; bio: string; events: EventType[]; basePath: string; embed: boolean }) {
  return (
    <PublicShell brand={props.brand} embed={props.embed}>
      <div className="card stack-sm">
        <ProfileHeader owner={props.brand} title={props.title} compact />
        {props.bio && <p className="muted" style={{ whiteSpace: "pre-line" }}>{props.bio}</p>}
      </div>
      <EventList events={props.events} basePath={props.basePath} embed={props.embed} />
    </PublicShell>
  );
}
