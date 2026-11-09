import { eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { getMembership, listMembers, pendingInvites } from "@/lib/teams";
import { CopyLink } from "@/components/CopyLink";
import { removeMemberAction, revokeInviteAction } from "../actions";
import { CreateTeamForm, InviteForm, RenameTeamForm } from "./TeamForms";

export default async function TeamPage() {
  const user = await requireUser();
  const membership = await getMembership(user.id);

  if (!membership) {
    return (
      <div className="stack">
        <div className="page-title"><h1>Team</h1></div>
        <div className="card stack">
          <p>
            Working with a co-host, cleaner coordinator or VA? Create a team to invite them. Each teammate gets their own
            booking page and connects their own calendar, and you can make <strong>team events</strong> that go to whoever&apos;s free
            (round robin) or need everyone at once.
          </p>
          <CreateTeamForm />
        </div>
        <UpgradeNote />
      </div>
    );
  }

  const { team, role } = membership;
  const members = await listMembers(team.id);
  const ids = members.map((m) => m.user.id);
  const db = getDb();
  const [cals, zooms] = await Promise.all([
    db.select({ userId: schema.calendarConnections.userId }).from(schema.calendarConnections).where(inArray(schema.calendarConnections.userId, ids)),
    db.select({ userId: schema.zoomConnections.userId }).from(schema.zoomConnections).where(inArray(schema.zoomConnections.userId, ids)),
  ]);
  const hasCal = new Set(cals.map((c) => c.userId));
  const hasZoom = new Set(zooms.map((z) => z.userId));
  const invites = role === "owner" ? await pendingInvites(team.id) : [];
  const teamEvents = await db.select({ id: schema.eventTypes.id }).from(schema.eventTypes).where(eq(schema.eventTypes.teamId, team.id));

  return (
    <div className="stack">
      <div className="page-title"><h1>{team.name}</h1></div>

      <div className="card stack-sm">
        <strong>Team booking page</strong>
        <CopyLink url={`${appUrl()}/team/${team.slug}`} />
        <p className="subtle">
          Lists the team events ({teamEvents.length}).{" "}
          {role === "owner" ? "Create them in Event types → choose “Team” under “Who hosts this?”." : "Your team owner manages them."}
        </p>
      </div>

      {role === "owner" && (
        <div className="card stack">
          <RenameTeamForm name={team.name} slug={team.slug} baseUrl={appUrl()} />
          <hr />
          <InviteForm />
          <p className="subtle">
            They get an email with a join link (valid 7 days). Until your email domain is verified in Resend, you&apos;ll get the
            link here to send them yourself, and teammates sign in with that link (it keeps them signed in for 30 days).
          </p>
        </div>
      )}

      <div className="card">
        <strong>Members</strong>
        <div className="list mt">
          {members.map(({ user: m, role: r }) => (
            <div key={m.id} className="list-item">
              <div className="stack-sm" style={{ gap: 2 }}>
                <span>
                  <strong>{m.name || m.email}</strong> {r === "owner" && <span className="badge badge-brand">Owner</span>}
                </span>
                <span className="subtle">{m.email} · /{m.username}</span>
                <span className="small">
                  {hasCal.has(m.id) ? "✅ Calendar" : "⬜️ Calendar not connected"} · {hasZoom.has(m.id) ? "✅ Zoom" : "Zoom not connected"}
                </span>
              </div>
              {role === "owner" && r !== "owner" && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="userId" value={m.id} />
                  <button className="btn btn-danger btn-sm">Remove</button>
                </form>
              )}
            </div>
          ))}
          {invites.map((i) => (
            <div key={i.tokenHash} className="list-item">
              <span>
                {i.email} <span className="badge">Invite sent</span>
              </span>
              <form action={revokeInviteAction}>
                <input type="hidden" name="id" value={i.tokenHash} />
                <button className="btn btn-ghost btn-sm">Cancel invite</button>
              </form>
            </div>
          ))}
        </div>
      </div>
      <UpgradeNote />
    </div>
  );
}

function UpgradeNote() {
  return (
    <p className="subtle center">
      Need roles &amp; permissions, a shared CRM, an AI note-taker or agents? That&apos;s the full version at{" "}
      <a href="https://cohoststudio.com" target="_blank" rel="noopener">cohoststudio.com</a>.
    </p>
  );
}
