import type { LocationType } from "./types";
import { randomId } from "./crypto";

export const LOCATION_LABELS: Record<LocationType, string> = {
  jitsi: "Video call (Jitsi, free)",
  link: "Video call (your own link: Zoom, StreamYard, Meet…)",
  phone: "Phone call",
  in_person: "In person",
};

/** A fresh, hard-to-guess room on the free public Jitsi server. */
export function jitsiRoomUrl(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 24);
  return `https://meet.jit.si/${base || "Meeting"}-${randomId(12)}`;
}

/** What gets stored on the booking (and shown in emails) for each location type. */
export function resolveLocation(
  type: LocationType,
  eventValue: string,
  title: string,
  guestPhone?: string,
): string {
  switch (type) {
    case "jitsi":
      return jitsiRoomUrl(title);
    case "link":
      return eventValue;
    case "phone":
      return guestPhone ? `Phone: ${guestPhone}` : eventValue ? `Phone: ${eventValue}` : "Phone call";
    case "in_person":
      return eventValue || "In person";
  }
}

export function locationDisplay(type: LocationType, value: string): string {
  if (type === "jitsi" || type === "link") return value;
  return value || LOCATION_LABELS[type];
}

export function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}
