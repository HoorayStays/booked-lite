"use client";

import { useActionState } from "react";
import type { CalendarInfo } from "@/lib/calendar/types";
import { saveCalendarChoice, type ActionState } from "../actions";

export function CalendarChoice({ calendars, busy, write }: { calendars: CalendarInfo[]; busy: string[]; write: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCalendarChoice, {});
  return (
    <form action={action} className="stack-sm">
      <strong className="small">Check these calendars for conflicts</strong>
      {calendars.map((c) => (
        <label key={c.id} className="check">
          <input type="checkbox" name="busy" value={c.id} defaultChecked={busy.includes(c.id)} /> {c.name}
          {c.primary && <span className="badge">main</span>}
        </label>
      ))}
      <p className="hint">Tip: tick your Airbnb / VRBO / PMS calendars too if they&apos;re synced into Google.</p>
      <label htmlFor="write" className="small" style={{ marginTop: 8 }}>Add new bookings to</label>
      <select id="write" name="write" defaultValue={write}>
        {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="row">
        <button className="btn btn-secondary btn-sm" disabled={pending}>Save calendar choices</button>
        {state.message && <span className="muted small">{state.message}</span>}
        {state.error && <span className="alert alert-error">{state.error}</span>}
      </div>
    </form>
  );
}
