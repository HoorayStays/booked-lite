"use client";

import { useActionState } from "react";
import { CopyLink } from "@/components/CopyLink";
import { createTeamAction, inviteAction, renameTeamAction, type ActionState } from "../actions";

function Status({ state }: { state: ActionState }) {
  return (
    <>
      {state.message && <span className="muted small" role="status">{state.message}</span>}
      {state.error && <span className="alert alert-error" role="alert">{state.error}</span>}
    </>
  );
}

export function CreateTeamForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTeamAction, {});
  return (
    <form action={action} className="stack-sm">
      <label htmlFor="team-name">Team name</label>
      <div className="row">
        <input id="team-name" name="name" type="text" placeholder="My rental team" required maxLength={80} style={{ flex: "1 1 220px" }} />
        <button className="btn" disabled={pending}>Create team</button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function RenameTeamForm({ name, slug, baseUrl }: { name: string; slug: string; baseUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(renameTeamAction, {});
  return (
    <form action={action} className="grid-2">
      <div>
        <label htmlFor="t-name">Team name</label>
        <input id="t-name" name="name" type="text" defaultValue={name} required maxLength={80} />
      </div>
      <div>
        <label htmlFor="t-slug">Team link name</label>
        <input id="t-slug" name="slug" type="text" defaultValue={slug} maxLength={40} />
        <p className="hint" style={{ wordBreak: "break-all" }}>{baseUrl}/team/{slug}</p>
      </div>
      <div className="row">
        <button className="btn btn-secondary btn-sm" disabled={pending}>Save</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteAction, {});
  return (
    <form action={action} className="stack-sm">
      <label htmlFor="invite-email">Invite a teammate by email</label>
      <div className="row">
        <input id="invite-email" name="email" type="email" placeholder="sam@example.com" required style={{ flex: "1 1 220px" }} />
        <button className="btn" disabled={pending}>{pending ? "Sending…" : "Send invite"}</button>
      </div>
      <Status state={state} />
      {state.link && <CopyLink url={state.link} />}
    </form>
  );
}
