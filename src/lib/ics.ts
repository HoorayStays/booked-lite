/** Builds .ics calendar invites (RFC 5545) that work in Google, Apple and Outlook. */

export type IcsEvent = {
  uid: string;
  sequence: number;
  start: number; // UTC ms
  end: number;
  title: string;
  description: string;
  location: string;
  url?: string;
  organizer: { name: string; email: string };
  attendee: { name: string; email: string };
  method: "REQUEST" | "CANCEL";
  now?: number;
};

export function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function escapeParam(s: string): string {
  return `"${s.replace(/["\r\n]/g, "")}"`;
}

/** Lines longer than 75 bytes must be folded (continuation lines start with a space). */
export function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, "utf8");
    const limit = parts.length === 0 ? 75 : 74;
    if (size + len > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(e: IcsEvent): string {
  const cancelled = e.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BOOKED Lite//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.now ?? Date.now())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SEQUENCE:${e.sequence}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    `LOCATION:${escapeText(e.location)}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    `ORGANIZER;CN=${escapeParam(e.organizer.name)}:mailto:${e.organizer.email}`,
    `ATTENDEE;CN=${escapeParam(e.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${e.attendee.email}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
