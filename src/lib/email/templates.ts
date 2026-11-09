import type { Booking, EventType, User } from "../db/schema";
import { formatDateTimeRange, timeZoneLabel } from "../format";
import { isUrl, locationDisplay } from "../location";
import { appUrl } from "../env";
import type { Email } from "./send";

const FOOTER_TEXT = "Scheduling by B👀KED Lite · Built by CoHost Studio (https://cohoststudio.com)";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(opts: { brand: string; heading: string; intro: string; rows: [string, string][]; buttons: { label: string; href: string }[]; note?: string }) {
  const rows = opts.rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#111827">${v}</td></tr>`,
    )
    .join("");
  const buttons = opts.buttons
    .map(
      (b, i) =>
        `<a href="${esc(b.href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;${
          i === 0 ? `background:${opts.brand};color:#ffffff` : "background:#f3f4f6;color:#111827"
        }">${esc(b.label)}</a>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border-radius:14px;padding:28px;border-top:4px solid ${opts.brand}">
<h1 style="margin:0 0 8px;font-size:20px;color:#111827">${esc(opts.heading)}</h1>
<p style="margin:0 0 18px;color:#374151;line-height:1.5">${opts.intro}</p>
<table style="border-collapse:collapse;font-size:14px;margin-bottom:18px">${rows}</table>
${buttons}
${opts.note ? `<p style="margin:18px 0 0;color:#6b7280;font-size:13px;line-height:1.5">${opts.note}</p>` : ""}
</div>
<p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">Scheduling by B👀KED Lite · Built by <a href="https://cohoststudio.com" style="color:#9ca3af">CoHost Studio</a></p>
</div></body></html>`;
}

type Ctx = { booking: Booking; eventType: EventType; owner: User };

export function manageUrl(b: Booking) {
  return `${appUrl()}/booking/${b.id}?token=${b.manageToken}`;
}
export function rescheduleUrl(b: Booking, owner: User, et: EventType) {
  return `${appUrl()}/${owner.username}/${et.slug}?reschedule=${b.id}&token=${b.manageToken}`;
}

function whereHtml(b: Booking) {
  const v = locationDisplay(b.locationType, b.locationValue);
  return isUrl(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v);
}

function detailRows(ctx: Ctx, tz: string, withGuest: boolean): [string, string][] {
  const { booking: b, eventType: et, owner } = ctx;
  const rows: [string, string][] = [
    ["What", esc(et.title)],
    ["When", `${esc(formatDateTimeRange(b.startUtc, b.endUtc, tz))}<br><span style="color:#6b7280">${esc(timeZoneLabel(tz))}</span>`],
    ["Where", whereHtml(b)],
  ];
  if (withGuest) {
    rows.push(["Guest", `${esc(b.guestName)} &lt;${esc(b.guestEmail)}&gt;`]);
    for (const q of et.questions) {
      const a = b.answers[q.id];
      if (a) rows.push([q.label, esc(a).replace(/\n/g, "<br>")]);
    }
  } else {
    rows.push(["Host", esc(owner.name || owner.username)]);
  }
  return rows;
}

function detailText(ctx: Ctx, tz: string, withGuest: boolean) {
  const { booking: b, eventType: et, owner } = ctx;
  const lines = [
    `What: ${et.title}`,
    `When: ${formatDateTimeRange(b.startUtc, b.endUtc, tz)} (${timeZoneLabel(tz)})`,
    `Where: ${locationDisplay(b.locationType, b.locationValue)}`,
  ];
  if (withGuest) {
    lines.push(`Guest: ${b.guestName} <${b.guestEmail}>`);
    for (const q of et.questions) if (b.answers[q.id]) lines.push(`${q.label}: ${b.answers[q.id]}`);
  } else lines.push(`Host: ${owner.name || owner.username}`);
  return lines.join("\n");
}

export function guestConfirmation(ctx: Ctx, kind: "new" | "rescheduled"): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner } = ctx;
  const heading = kind === "new" ? "You're booked! 🎉" : "Your booking was moved";
  const hostName = owner.name || owner.username;
  const manage = manageUrl(b);
  const resched = rescheduleUrl(b, owner, et);
  return {
    subject: `${kind === "new" ? "Confirmed" : "Updated"}: ${et.title} with ${hostName}`,
    html: layout({
      brand: owner.brandColor,
      heading,
      intro: `Hi ${esc(b.guestName)}, your ${esc(et.title)} with ${esc(hostName)} is confirmed. A calendar invite is attached.`,
      rows: detailRows(ctx, b.guestTimezone, false),
      buttons: [
        { label: "Reschedule", href: resched },
        { label: "Cancel", href: manage },
      ],
    }),
    text: `${heading}\n\n${detailText(ctx, b.guestTimezone, false)}\n\nReschedule: ${resched}\nCancel: ${manage}\n\n${FOOTER_TEXT}`,
    replyTo: owner.email,
  };
}

export function ownerNotification(ctx: Ctx, kind: "new" | "rescheduled" | "cancelled", reason?: string): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner } = ctx;
  const verb = kind === "new" ? "New booking" : kind === "rescheduled" ? "Booking moved" : "Booking cancelled";
  const admin = `${appUrl()}/admin`;
  return {
    subject: `${verb}: ${et.title} with ${b.guestName}`,
    html: layout({
      brand: owner.brandColor,
      heading: verb,
      intro: `${esc(b.guestName)} ${kind === "new" ? "booked" : kind === "rescheduled" ? "moved" : "cancelled"} a ${esc(et.title)}.${reason ? ` Reason: “${esc(reason)}”` : ""}`,
      rows: detailRows(ctx, owner.timezone, true),
      buttons: [{ label: "Open bookings", href: admin }],
    }),
    text: `${verb}\n\n${detailText(ctx, owner.timezone, true)}${reason ? `\nReason: ${reason}` : ""}\n\n${admin}`,
    replyTo: b.guestEmail,
  };
}

export function guestCancellation(ctx: Ctx, by: "guest" | "owner", reason?: string): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner } = ctx;
  const hostName = owner.name || owner.username;
  const again = `${appUrl()}/${owner.username}/${et.slug}`;
  return {
    subject: `Cancelled: ${et.title} with ${hostName}`,
    html: layout({
      brand: owner.brandColor,
      heading: "Booking cancelled",
      intro:
        by === "owner"
          ? `${esc(hostName)} had to cancel this booking.${reason ? ` Their note: “${esc(reason)}”` : ""}`
          : "Your booking has been cancelled.",
      rows: detailRows(ctx, b.guestTimezone, false),
      buttons: [{ label: "Pick a new time", href: again }],
    }),
    text: `Booking cancelled\n\n${detailText(ctx, b.guestTimezone, false)}${reason ? `\nNote: ${reason}` : ""}\n\nPick a new time: ${again}\n\n${FOOTER_TEXT}`,
    replyTo: owner.email,
  };
}

export function guestReminder(ctx: Ctx): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner } = ctx;
  const hostName = owner.name || owner.username;
  const manage = manageUrl(b);
  const resched = rescheduleUrl(b, owner, et);
  const join = isUrl(b.locationValue) ? [{ label: "Join call", href: b.locationValue }] : [];
  return {
    subject: `Reminder: ${et.title} with ${hostName}`,
    html: layout({
      brand: owner.brandColor,
      heading: "See you soon 👋",
      intro: `Just a reminder about your ${esc(et.title)} with ${esc(hostName)}.`,
      rows: detailRows(ctx, b.guestTimezone, false),
      buttons: [...join, { label: "Reschedule", href: resched }, { label: "Cancel", href: manage }],
      note:
        b.locationType === "jitsi"
          ? "Tip: Jitsi runs in your browser. No download needed. On a phone, the free Jitsi Meet app works best."
          : undefined,
    }),
    text: `Reminder\n\n${detailText(ctx, b.guestTimezone, false)}\n\nReschedule: ${resched}\nCancel: ${manage}\n\n${FOOTER_TEXT}`,
    replyTo: owner.email,
  };
}

export function magicLinkEmail(link: string): Omit<Email, "to"> {
  return {
    subject: "Your B👀KED Lite sign-in link",
    html: layout({
      brand: "#4f46e5",
      heading: "Sign in to B👀KED Lite",
      intro: "Tap the button below to sign in. The link works once and expires in 15 minutes.",
      rows: [],
      buttons: [{ label: "Sign in", href: link }],
      note: "If you didn't ask for this, you can ignore this email.",
    }),
    text: `Sign in to B👀KED Lite:\n${link}\n\nThe link works once and expires in 15 minutes.`,
  };
}
