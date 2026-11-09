"use client";

import { useActionState, useState } from "react";
import type { EventType } from "@/lib/db/schema";
import type { LocationType, Question } from "@/lib/types";
import { LOCATION_LABELS } from "@/lib/location";
import { saveEventType, type ActionState } from "../../actions";

export function EventForm({ eventType: et, baseUrl }: { eventType: EventType; baseUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveEventType.bind(null, et.id), {});
  const [locationType, setLocationType] = useState<LocationType>(et.locationType);
  const [questions, setQuestions] = useState<Question[]>(et.questions);
  const [slug, setSlug] = useState(et.slug);

  const updateQ = (i: number, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  return (
    <form action={action} className="card stack">
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={et.active} /> Show this on my booking page
      </label>
      <div className="grid-2">
        <div>
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" defaultValue={et.title} required maxLength={120} />
        </div>
        <div>
          <label htmlFor="slug">Link name</label>
          <input id="slug" name="slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={60} />
          <p className="hint" style={{ wordBreak: "break-all" }}>{baseUrl}{slug || "…"}</p>
        </div>
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={et.description} maxLength={2000} placeholder="What is this meeting about? What should guests prepare?" />
      </div>

      <hr />
      <strong>Timing</strong>
      <div className="grid-2">
        <div>
          <label htmlFor="durationMin">Length (minutes)</label>
          <input id="durationMin" name="durationMin" type="number" min={5} max={600} defaultValue={et.durationMin} required />
        </div>
        <div>
          <label htmlFor="slotStepMin">Offer a start time every (minutes)</label>
          <input id="slotStepMin" name="slotStepMin" type="number" min={5} max={240} defaultValue={et.slotStepMin} required />
          <p className="hint">e.g. 30 → 9:00, 9:30, 10:00…</p>
        </div>
        <div>
          <label htmlFor="bufferBeforeMin">Free time before (minutes)</label>
          <input id="bufferBeforeMin" name="bufferBeforeMin" type="number" min={0} max={240} defaultValue={et.bufferBeforeMin} />
        </div>
        <div>
          <label htmlFor="bufferAfterMin">Free time after (minutes)</label>
          <input id="bufferAfterMin" name="bufferAfterMin" type="number" min={0} max={240} defaultValue={et.bufferAfterMin} />
        </div>
        <div>
          <label htmlFor="minNoticeHours">Minimum notice (hours)</label>
          <input id="minNoticeHours" name="minNoticeHours" type="number" min={0} step={0.5} max={1440} defaultValue={et.minNoticeMin / 60} />
          <p className="hint">Guests can&apos;t book sooner than this.</p>
        </div>
        <div>
          <label htmlFor="dailyLimit">Max bookings per day</label>
          <input id="dailyLimit" name="dailyLimit" type="number" min={0} max={100} defaultValue={et.dailyLimit ?? ""} placeholder="No limit" />
        </div>
        <div>
          <label htmlFor="maxDaysAhead">How far ahead can people book (days)</label>
          <input id="maxDaysAhead" name="maxDaysAhead" type="number" min={1} max={365} defaultValue={et.maxDaysAhead} />
        </div>
      </div>

      <hr />
      <strong>Where</strong>
      <div className="grid-2">
        <div>
          <label htmlFor="locationType">Meeting type</label>
          <select id="locationType" name="locationType" value={locationType} onChange={(e) => setLocationType(e.target.value as LocationType)}>
            {(Object.keys(LOCATION_LABELS) as LocationType[]).map((k) => (
              <option key={k} value={k}>{LOCATION_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div>
          {locationType === "jitsi" && (
            <p className="hint" style={{ marginTop: 28 }}>
              Each booking gets its own private room on the free meet.jit.si. Nothing to set up.
              <input type="hidden" name="locationValue" value="" />
            </p>
          )}
          {locationType === "link" && (
            <>
              <label htmlFor="locationValue">Your meeting link</label>
              <input id="locationValue" name="locationValue" type="url" defaultValue={et.locationValue} placeholder="https://zoom.us/j/…" required />
            </>
          )}
          {locationType === "phone" && (
            <>
              <label htmlFor="locationValue">Note (optional)</label>
              <input id="locationValue" name="locationValue" type="text" defaultValue={et.locationValue} placeholder="I'll call you" />
              <p className="hint">Guests are asked for their phone number.</p>
            </>
          )}
          {locationType === "in_person" && (
            <>
              <label htmlFor="locationValue">Address</label>
              <input id="locationValue" name="locationValue" type="text" defaultValue={et.locationValue} placeholder="123 Main St, Austin, TX" />
            </>
          )}
        </div>
      </div>

      <hr />
      <strong>Questions for guests</strong>
      <p className="subtle">Name and email are always asked. Add anything else you need, e.g. &quot;Property address&quot;.</p>
      {questions.map((q, i) => (
        <div key={q.id} className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 220px" }}>
            <label htmlFor={`ql-${q.id}`}>Question {i + 1}</label>
            <input id={`ql-${q.id}`} type="text" value={q.label} onChange={(e) => updateQ(i, { label: e.target.value })} maxLength={200} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label htmlFor={`qt-${q.id}`} className="sr-only">Answer type</label>
            <select id={`qt-${q.id}`} value={q.type} onChange={(e) => updateQ(i, { type: e.target.value as Question["type"] })}>
              <option value="text">Short answer</option>
              <option value="textarea">Long answer</option>
              <option value="phone">Phone number</option>
            </select>
          </div>
          <label className="check" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={q.required} onChange={(e) => updateQ(i, { required: e.target.checked })} /> Required
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      {questions.length < 10 && (
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setQuestions((qs) => [...qs, { id: Math.random().toString(36).slice(2, 10), label: "", type: "text", required: false }])}
          >
            + Add question
          </button>
        </div>
      )}

      <div className="row">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.message && <span className="muted" role="status">{state.message}</span>}
        {state.error && <span className="alert alert-error" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}
