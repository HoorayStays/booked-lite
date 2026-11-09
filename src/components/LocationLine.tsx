import type { LocationType } from "@/lib/types";
import { PhoneIcon, PinIcon, VideoIcon } from "./Icons";

export function LocationLine({ type, value }: { type: LocationType; value: string }) {
  if (type === "phone") return (<div><PhoneIcon /><span>Phone call{value ? ` · ${value}` : ""}</span></div>);
  if (type === "in_person") return (<div><PinIcon /><span>{value || "In person"}</span></div>);
  if (type === "zoom") return (<div><VideoIcon /><span>Zoom · link sent after booking</span></div>);
  if (type === "google_meet") return (<div><VideoIcon /><span>Google Meet · link sent after booking</span></div>);
  if (type === "jitsi") return (<div><VideoIcon /><span>Video call (Jitsi) · link sent after booking</span></div>);
  return (<div><VideoIcon /><span>Video call · link sent after booking</span></div>);
}
