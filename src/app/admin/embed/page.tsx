import { and, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { getMembership } from "@/lib/teams";
import { CopyLink } from "@/components/CopyLink";
import { EmbedBuilder } from "./EmbedBuilder";

export default async function EmbedPage() {
  const user = await requireUser();
  const db = getDb();
  const mine = await db
    .select()
    .from(schema.eventTypes)
    .where(and(eq(schema.eventTypes.userId, user.id), eq(schema.eventTypes.active, true), isNull(schema.eventTypes.teamId)));
  const membership = await getMembership(user.id);
  const teamEvents = membership
    ? await db.select().from(schema.eventTypes).where(and(eq(schema.eventTypes.teamId, membership.team.id), eq(schema.eventTypes.active, true)))
    : [];
  const pages = [
    ...mine.map((e) => ({ label: e.title, path: `/${user.username}/${e.slug}` })),
    { label: "My page (all my event types)", path: `/${user.username}` },
    ...(membership
      ? [
          ...teamEvents.map((e) => ({ label: `${membership.team.name}: ${e.title}`, path: `/team/${membership.team.slug}/${e.slug}` })),
          { label: `${membership.team.name} team page`, path: `/team/${membership.team.slug}` },
        ]
      : []),
  ];
  return (
    <div className="stack">
      <div className="page-title"><h1>Share &amp; embed</h1></div>
      <div className="card stack-sm">
        <strong>Your link</strong>
        <CopyLink url={`${appUrl()}/${user.username}`} />
        <p className="subtle">Paste it in Airbnb messages, emails, your Instagram bio or your email signature.</p>
      </div>
      <EmbedBuilder pages={pages} baseUrl={appUrl()} brandColor={user.brandColor} />
    </div>
  );
}
