import type { Booking, EventType, Team, User } from "../db/schema";
import { formatDateTimeRange, timeZoneLabel } from "../format";
import { isUrl, locationDisplay } from "../location";
import { appUrl } from "../env";
import type { Email } from "./send";

const FOOTER_TEXT = "Scheduling by B👀KED Lite · Built by CoHost Studio (https://cohoststudio.com)";

/**
 * Everything an email needs about a booking.
 * `owner` = who owns the event type (their brand + link are used); `hosts` = who actually meets the guest.
 */
export type BookingCtx = { booking: Booking; eventType: EventType; owner: User; hosts: User[]; team: Team | null };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function displayName(u: User) {
  return u.name || u.username;
}

/** "Alex", "Alex & Sam", or "Alex (Example Stays)" for team events. */
export function hostLabel(ctx: Pick<BookingCtx, "hosts" | "team" | "owner">) {
  const names = (ctx.hosts.length ? ctx.hosts : [ctx.owner]).map(displayName).join(" & ");
  return ctx.team ? `${names} (${ctx.team.name})` : names;
}

export function eventPageUrl(et: EventType, owner: User, team: Team | null) {
  return team && et.teamId ? `${appUrl()}/team/${team.slug}/${et.slug}` : `${appUrl()}/${owner.username}/${et.slug}`;
}
export function manageUrl(b: Booking) {
  return `${appUrl()}/booking/${b.id}?token=${b.manageToken}`;
}
export function rescheduleUrl(ctx: BookingCtx) {
  return `${eventPageUrl(ctx.eventType, ctx.owner, ctx.team)}?reschedule=${ctx.booking.id}&token=${ctx.booking.manageToken}`;
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

function whereHtml(b: Booking) {
  const v = locationDisplay(b.locationType, b.locationValue);
  return isUrl(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v);
}

/** Lines describing where to meet, including a Zoom passcode when there is one. */
export function whereText(b: Booking) {
  const where = locationDisplay(b.locationType, b.locationValue);
  return b.meetingPassword ? `${where} (passcode: ${b.meetingPassword})` : where;
}

function detailRows(ctx: BookingCtx, tz: string, forHost: boolean): [string, string][] {
  const { booking: b, eventType: et } = ctx;
  const rows: [string, string][] = [
    ["What", esc(et.title)],
    ["When", `${esc(formatDateTimeRange(b.startUtc, b.endUtc, tz))}<br><span style="color:#6b7280">${esc(timeZoneLabel(tz))}</span>`],
    ["Where", whereHtml(b)],
  ];
  if (b.meetingPassword) rows.push(["Passcode", esc(b.meetingPassword)]);
  if (forHost) {
    rows.push(["Guest", `${esc(b.guestName)} &lt;${esc(b.guestEmail)}&gt;`]);
    if (ctx.hosts.length > 1 || ctx.team) rows.push(["Hosts", esc(ctx.hosts.map(displayName).join(", "))]);
    for (const q of et.questions) {
      const a = b.answers[q.id];
      if (a) rows.push([q.label, esc(a).replace(/\n/g, "<br>")]);
    }
  } else {
    rows.push(["Host", esc(hostLabel(ctx))]);
  }
  return rows;
}

function detailText(ctx: BookingCtx, tz: string, forHost: boolean) {
  const { booking: b, eventType: et } = ctx;
  const lines = [
    `What: ${et.title}`,
    `When: ${formatDateTimeRange(b.startUtc, b.endUtc, tz)} (${timeZoneLabel(tz)})`,
    `Where: ${whereText(b)}`,
  ];
  if (forHost) {
    lines.push(`Guest: ${b.guestName} <${b.guestEmail}>`);
    if (ctx.hosts.length > 1 || ctx.team) lines.push(`Hosts: ${ctx.hosts.map(displayName).join(", ")}`);
    for (const q of et.questions) if (b.answers[q.id]) lines.push(`${q.label}: ${b.answers[q.id]}`);
  } else lines.push(`Host: ${hostLabel(ctx)}`);
  return lines.join("\n");
}

const replyTo = (ctx: BookingCtx) => (ctx.hosts[0] ?? ctx.owner).email;

export function guestConfirmation(ctx: BookingCtx, kind: "new" | "rescheduled"): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner } = ctx;
  const heading = kind === "new" ? "You're booked! 🎉" : "Your booking was moved";
  const host = hostLabel(ctx);
  const manage = manageUrl(b);
  const resched = rescheduleUrl(ctx);
  return {
    subject: `${kind === "new" ? "Confirmed" : "Updated"}: ${et.title} with ${host}`,
    html: layout({
      brand: owner.brandColor,
      heading,
      intro: `Hi ${esc(b.guestName)}, your ${esc(et.title)} with ${esc(host)} is confirmed. A calendar invite is attached.`,
      rows: detailRows(ctx, b.guestTimezone, false),
      buttons: [
        ...(isUrl(b.locationValue) ? [{ label: "Join link", href: b.locationValue }] : []),
        { label: "Reschedule", href: resched },
        { label: "Cancel", href: manage },
      ],
    }),
    text: `${heading}\n\n${detailText(ctx, b.guestTimezone, false)}\n\nReschedule: ${resched}\nCancel: ${manage}\n\n${FOOTER_TEXT}`,
    replyTo: replyTo(ctx),
  };
}

export function hostNotification(ctx: BookingCtx, host: User, kind: "new" | "rescheduled" | "cancelled", reason?: string): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner } = ctx;
  const verb = kind === "new" ? "New booking" : kind === "rescheduled" ? "Booking moved" : "Booking cancelled";
  const admin = `${appUrl()}/admin`;
  return {
    subject: `${verb}: ${et.title} with ${b.guestName}`,
    html: layout({
      brand: owner.brandColor,
      heading: verb,
      intro: `${esc(b.guestName)} ${kind === "new" ? "booked" : kind === "rescheduled" ? "moved" : "cancelled"} a ${esc(et.title)}.${reason ? ` Reason: “${esc(reason)}”` : ""}`,
      rows: detailRows(ctx, host.timezone, true),
      buttons: [{ label: "Open bookings", href: admin }],
    }),
    text: `${verb}\n\n${detailText(ctx, host.timezone, true)}${reason ? `\nReason: ${reason}` : ""}\n\n${admin}`,
    replyTo: b.guestEmail,
  };
}

export function guestCancellation(ctx: BookingCtx, by: "guest" | "owner", reason?: string): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner, team } = ctx;
  const host = hostLabel(ctx);
  const again = eventPageUrl(et, owner, team);
  return {
    subject: `Cancelled: ${et.title} with ${host}`,
    html: layout({
      brand: owner.brandColor,
      heading: "Booking cancelled",
      intro:
        by === "owner"
          ? `${esc(host)} had to cancel this booking.${reason ? ` Their note: “${esc(reason)}”` : ""}`
          : "Your booking has been cancelled.",
      rows: detailRows(ctx, b.guestTimezone, false),
      buttons: [{ label: "Pick a new time", href: again }],
    }),
    text: `Booking cancelled\n\n${detailText(ctx, b.guestTimezone, false)}${reason ? `\nNote: ${reason}` : ""}\n\nPick a new time: ${again}\n\n${FOOTER_TEXT}`,
    replyTo: replyTo(ctx),
  };
}

export function guestReminder(ctx: BookingCtx): Omit<Email, "to"> {
  const { booking: b, eventType: et, owner } = ctx;
  const host = hostLabel(ctx);
  const manage = manageUrl(b);
  const resched = rescheduleUrl(ctx);
  const join = isUrl(b.locationValue) ? [{ label: "Join call", href: b.locationValue }] : [];
  const tips: Partial<Record<Booking["locationType"], string>> = {
    jitsi: "Tip: Jitsi runs in your browser. No download needed. On a phone, the free Jitsi Meet app works best.",
    zoom: "Tip: on a phone, install the free Zoom app before the call.",
    google_meet: "Tip: Google Meet works in your browser. On a phone, use the Google Meet app.",
  };
  return {
    subject: `Reminder: ${et.title} with ${host}`,
    html: layout({
      brand: owner.brandColor,
      heading: "See you soon 👋",
      intro: `Just a reminder about your ${esc(et.title)} with ${esc(host)}.`,
      rows: detailRows(ctx, b.guestTimezone, false),
      buttons: [...join, { label: "Reschedule", href: resched }, { label: "Cancel", href: manage }],
      note: tips[b.locationType],
    }),
    text: `Reminder\n\n${detailText(ctx, b.guestTimezone, false)}\n\nReschedule: ${resched}\nCancel: ${manage}\n\n${FOOTER_TEXT}`,
    replyTo: replyTo(ctx),
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

export function teamInviteEmail(teamName: string, inviterName: string, link: string): Omit<Email, "to"> {
  return {
    subject: `${inviterName} invited you to join ${teamName} on B👀KED Lite`,
    html: layout({
      brand: "#4f46e5",
      heading: `Join ${esc(teamName)}`,
      intro: `${esc(inviterName)} invited you to share booking pages with the team. You'll get your own booking page and can connect your own calendar.`,
      rows: [],
      buttons: [{ label: "Accept invite", href: link }],
      note: "The invite link works once and expires in 7 days.",
    }),
    text: `${inviterName} invited you to join ${teamName} on B👀KED Lite.\n\nAccept: ${link}\n\nThe link works once and expires in 7 days.`,
  };
}

/**
 * Before the host verifies an email domain, Resend can only deliver to the host's own address.
 * So the guest's email goes to the host instead, with a note asking them to forward it.
 */
export function forwardToGuest(email: Omit<Email, "to">, guestName: string, guestEmail: string): Omit<Email, "to"> {
  const note =
    `Your email domain isn't verified in Resend yet, so B👀KED Lite couldn't email ${guestName} (${guestEmail}). ` +
    `Please forward this message to them (any calendar invite is attached). They also saw all the details on screen after booking. ` +
    `To email guests automatically, verify a domain: SETUP.md → "No domain yet?".`;
  const banner = `<div style="background:#fff7e6;color:#92400e;border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:14px;line-height:1.5">📨 <strong>Forward to your guest.</strong> ${esc(note)}</div>`;
  return {
    ...email,
    subject: `[Forward to ${guestName}] ${email.subject}`,
    html: email.html.replace('<div style="max-width:560px;margin:0 auto;padding:24px 16px">', (m) => m + banner),
    text: `📨 FORWARD TO YOUR GUEST: ${note}\n\n----------\n\n${email.text}`,
    replyTo: guestEmail,
  };
}
