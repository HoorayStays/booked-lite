"use client";

import { useSyncExternalStore } from "react";

let cache: string[] | null = null;
const subscribe = () => () => {};
const getClient = () => (cache ??= typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []);
const EMPTY: string[] = [];
const getServer = () => EMPTY;

/** All IANA timezones known to this browser, always including `current`. Empty on the server (avoids hydration mismatches). */
export function useTimeZones(current: string): string[] {
  const zones = useSyncExternalStore(subscribe, getClient, getServer);
  return zones.includes(current) ? zones : [current, ...zones];
}
