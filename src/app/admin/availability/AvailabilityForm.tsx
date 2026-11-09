"use client";

import { useActionState, useState } from "react";
import type { DateOverride, TimeRange, WeeklyHours } from "@/lib/types";
import { useTimeZones } from "@/components/useTimeZones";
import { saveAvailability, type ActionState } from "../actions";

const DAYS: [keyof WeeklyHours, string][] = [
  ["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"], ["0", "Sunday"],
];

function Ranges({ ranges, onChange, idPrefix }: { ranges: TimeRange[]; onChange: (r: TimeRange[]) => void; idPrefix: string }) {
  return (
    <div className="stack-sm">
      {ranges.length === 0 && <span className="subtle" style={{ paddingTop: 10 }}>Unavailable</span>}
      {ranges.map((r, i) => (
        <div key={i} className="range">
          <label className="sr-only" htmlFor={`${idPrefix}-${i}-s`}>From</label>
          <input id={`${idPrefix}-${i}-s`} type="time" value={r.start} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
          <span className="subtle">to</span>
          <label className="sr-only" htmlFor={`${idPrefix}-${i}-e`}>To</label>
          <input id={`${idPrefix}-${i}-e`} type="time" value={r.end} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove hours" onClick={() => onChange(ranges.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => onChange([...ranges, ranges.length ? { start: "13:00", end: "17:00" } : { start: "09:00", end: "17:00" }])}>
          + Add hours
        </button>
      </div>
    </div>
  );
}

export function AvailabilityForm(props: { timezone: string; weekly: WeeklyHours; overrides: DateOverride[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAvailability, {});
  const [timezone, setTimezone] = useState(props.timezone);
  const [weekly, setWeekly] = useState<WeeklyHours>(props.weekly);
  const [overrides, setOverrides] = useState<DateOverride[]>(props.overrides);
  const zones = useTimeZones(timezone);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="payload" value={JSON.stringify({ timezone, weekly, overrides })} />
      <div className="card stack-sm">
        <label htmlFor="timezone">Your timezone</label>
        <div className="row">
          <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ flex: "1 1 240px" }}>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}>
            Use this device&apos;s timezone
          </button>
        </div>
        <p className="hint">Guests see times in their own timezone automatically.</p>
      </div>

      <div className="card">
        <strong>Weekly hours</strong>
        {DAYS.map(([key, label]) => (
          <div key={key} className="day-row">
            <label className="check">
              <input
                type="checkbox"
                checked={weekly[key].length > 0}
                onChange={(e) => setWeekly({ ...weekly, [key]: e.target.checked ? [{ start: "09:00", end: "17:00" }] : [] })}
              />
              {label}
            </label>
            <Ranges idPrefix={`d${key}`} ranges={weekly[key]} onChange={(r) => setWeekly({ ...weekly, [key]: r })} />
          </div>
        ))}
      </div>

      <div className="card stack-sm">
        <strong>Date overrides</strong>
        <p className="subtle">Holidays, turnover days or special hours. A date with no hours is a day off.</p>
        {overrides.map((o, i) => (
          <div key={i} className="day-row">
            <div className="stack-sm">
              <label className="sr-only" htmlFor={`od-${i}`}>Date</label>
              <input id={`od-${i}`} type="date" value={o.date} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
              <button type="button" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, justifyContent: "flex-start" }} onClick={() => setOverrides(overrides.filter((_, j) => j !== i))}>
                Remove date
              </button>
            </div>
            <Ranges idPrefix={`o${i}`} ranges={o.ranges} onChange={(r) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, ranges: r } : x)))} />
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOverrides([...overrides, { date: "", ranges: [] }])}>
            + Add a date
          </button>
        </div>
      </div>

      <div className="row">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save availability"}</button>
        {state.message && <span className="muted" role="status">{state.message}</span>}
        {state.error && <span className="alert alert-error" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}
