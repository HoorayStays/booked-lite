"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/types";
import { dateKey, formatDateTimeRange, formatTime, timeZoneLabel } from "@/lib/format";
import { useTimeZones } from "@/components/useTimeZones";
import { ChevronLeft, ChevronRight, GlobeIcon } from "@/components/Icons";

type Props = {
  eventId: string;
  embed?: boolean;
  durationMin: number;
  questions: Question[];
  askPhone: boolean;
  reschedule?: { id: string; token: string; start: number };
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The visitor's timezone is only known in the browser.
const subscribe = () => () => {};
const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const serverTz = () => "";

function monthOf(key: string) {
  return key.slice(0, 7); // YYYY-MM
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function BookingWidget({ eventId, embed, durationMin, questions, askPhone, reschedule }: Props) {
  const detectedTz = useSyncExternalStore(subscribe, browserTz, serverTz);
  const [chosenTz, setChosenTz] = useState<string | null>(null);
  const tz = chosenTz ?? detectedTz;
  const [hour12, setHour12] = useState(true);
  const [month, setMonth] = useState<string | null>(null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoAdvanced, setAutoAdvanced] = useState(false);

  const zones = useTimeZones(tz || "UTC");
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const todayKey = tz ? dateKey(now, tz) : "";
  const currentMonth = month ?? (todayKey ? monthOf(todayKey) : null);

  const load = useCallback(
    async (ym: string) => {
      const [y, m] = ym.split("-").map(Number);
      const from = Date.UTC(y, m - 1, 1) - 15 * 3_600_000;
      const to = Date.UTC(y, m, 1) + 15 * 3_600_000;
      const qs = new URLSearchParams({ event: eventId, from: String(from), to: String(to) });
      if (reschedule) qs.set("ignore", reschedule.id);
      const res = await fetch(`/api/slots?${qs}`);
      if (!res.ok) throw new Error("Could not load times");
      return ((await res.json()) as { slots: number[] }).slots;
    },
    [eventId, reschedule],
  );

  useEffect(() => {
    if (!currentMonth) return;
    let cancelled = false;
    load(currentMonth)
      .then((s) => {
        if (!cancelled) setSlots(s);
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setError("We couldn't load available times. Please refresh the page.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentMonth, load]);

  const byDate = new Map<string, number[]>();
  if (slots && tz && currentMonth) {
    for (const s of slots) {
      const k = dateKey(s, tz);
      if (monthOf(k) === currentMonth) byDate.set(k, [...(byDate.get(k) ?? []), s]);
    }
  }

  // If this month is fully booked, jump ahead once so visitors don't see an empty calendar.
  const firstAvailable = byDate.keys().next().value as string | undefined;
  if (slots && currentMonth && byDate.size === 0 && !autoAdvanced && currentMonth === monthOf(todayKey)) {
    setAutoAdvanced(true);
    setSlots(null);
    setMonth(shiftMonth(currentMonth, 1));
  }
  const activeDate = selectedDate && byDate.has(selectedDate) ? selectedDate : firstAvailable ?? null;

  if (!tz || !currentMonth) {
    return (
      <div className="booker-pick" aria-busy>
        <div className="skeleton" style={{ minHeight: 300 }} />
      </div>
    );
  }

  const [y, m] = currentMonth.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    Date.UTC(y, m - 1, 1),
  );

  function changeMonth(delta: number) {
    setSlots(null);
    setSelectedDate(null);
    setMonth(shiftMonth(currentMonth!, delta));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected == null) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const answers: Record<string, string> = {};
    for (const q of questions) answers[q.id] = String(form.get(`q_${q.id}`) ?? "");
    try {
      const res = reschedule
        ? await fetch(`/api/bookings/${reschedule.id}/reschedule`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: reschedule.token, start: selected }),
          })
        : await fetch("/api/bookings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              event: eventId,
              start: selected,
              name: form.get("name"),
              email: form.get("email"),
              phone: askPhone ? form.get("phone") : undefined,
              timezone: tz,
              answers,
              website: form.get("website") || undefined,
            }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push(`/booking/${data.id}?token=${encodeURIComponent(data.token)}&done=1${embed ? "&embed=1" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
      if (reschedule || String(err).includes("taken")) {
        setSelected(null);
        setSlots(null);
        load(currentMonth!).then(setSlots).catch(() => setSlots([]));
      }
    }
  }

  if (selected != null) {
    return (
      <div className="booker-pick form-step">
        <form className="stack" onSubmit={submit}>
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} style={{ paddingLeft: 0 }}>
              <ChevronLeft /> Back
            </button>
          </div>
          <div className="alert alert-ok" data-testid="selected-time">
            <strong>{formatDateTimeRange(selected, selected + durationMin * 60_000, tz)}</strong>
            <div className="small">{timeZoneLabel(tz)}</div>
          </div>
          {reschedule ? (
            <p className="muted">Moving your booking from {formatDateTimeRange(reschedule.start, reschedule.start + durationMin * 60_000, tz)}.</p>
          ) : (
            <>
              <div>
                <label htmlFor="name">Your name</label>
                <input id="name" name="name" type="text" autoComplete="name" required maxLength={120} />
              </div>
              <div>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" required maxLength={200} />
                <p className="hint">We&apos;ll send your confirmation and calendar invite here.</p>
              </div>
              {askPhone && (
                <div>
                  <label htmlFor="phone">Phone number</label>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={40} />
                </div>
              )}
              {questions.map((q) => (
                <div key={q.id}>
                  <label htmlFor={`q_${q.id}`}>
                    {q.label} {!q.required && <span className="subtle">(optional)</span>}
                  </label>
                  {q.type === "textarea" ? (
                    <textarea id={`q_${q.id}`} name={`q_${q.id}`} required={q.required} maxLength={2000} />
                  ) : (
                    <input id={`q_${q.id}`} name={`q_${q.id}`} type={q.type === "phone" ? "tel" : "text"} required={q.required} maxLength={2000} />
                  )}
                </div>
              ))}
              <div className="sr-only" aria-hidden>
                <label htmlFor="website">Leave this empty</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
            </>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn btn-block" type="submit" disabled={submitting}>
            {submitting ? "Booking…" : reschedule ? "Confirm new time" : "Confirm booking"}
          </button>
        </form>
      </div>
    );
  }

  const times = activeDate ? byDate.get(activeDate) ?? [] : [];

  return (
    <div className="booker-pick">
      <div>
        {reschedule && (
          <div className="alert alert-warn" style={{ marginBottom: 14 }}>
            Pick a new time. Your current booking: {formatDateTimeRange(reschedule.start, reschedule.start + durationMin * 60_000, tz)}
          </div>
        )}
        <div className="cal-head">
          <h3>{monthName}</h3>
          <div className="row" style={{ gap: 6 }}>
            <button className="icon-btn" aria-label="Previous month" onClick={() => changeMonth(-1)} disabled={currentMonth <= monthOf(todayKey)}>
              <ChevronLeft />
            </button>
            <button className="icon-btn" aria-label="Next month" onClick={() => changeMonth(1)}>
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="cal-grid" role="grid" aria-label="Choose a day">
          {DOW.map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`pad${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const key = `${currentMonth}-${String(i + 1).padStart(2, "0")}`;
            const available = byDate.has(key);
            const cls = ["day", available && "available", key === activeDate && "selected", key === todayKey && "today"].filter(Boolean).join(" ");
            return (
              <button
                key={key}
                className={cls}
                disabled={!available}
                onClick={() => setSelectedDate(key)}
                aria-label={`${key}${available ? ", has open times" : ""}`}
                aria-pressed={key === activeDate}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="tz-row row" style={{ gap: 8 }}>
          <GlobeIcon />
          <label htmlFor="tz" className="sr-only">Timezone</label>
          <select id="tz" value={tz} onChange={(e) => setChosenTz(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
            {zones.map((z) => (
              <option key={z} value={z}>{timeZoneLabel(z)}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setHour12(!hour12)} type="button">
            {hour12 ? "24h" : "12h"}
          </button>
        </div>
      </div>
      <div className="times">
        {slots === null ? (
          <>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </>
        ) : activeDate ? (
          <>
            <h3>
              {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
                Date.parse(`${activeDate}T12:00:00Z`),
              )}
            </h3>
            <div className="times-scroll">
              {times.map((t) => (
                <button key={t} className="time-btn" onClick={() => setSelected(t)}>
                  {formatTime(t, tz, hour12)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">No open times this month. Try the next month.</p>
        )}
        {error && !selected && <div className="alert alert-error" role="alert">{error}</div>}
      </div>
    </div>
  );
}
