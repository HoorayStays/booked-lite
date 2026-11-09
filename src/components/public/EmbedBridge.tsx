"use client";

import { useEffect } from "react";

/**
 * When a page is shown inside the embed widget (an iframe on someone's website),
 * tell the parent page our height so the iframe grows/shrinks with the content.
 */
export function EmbedBridge({ event }: { event?: "scheduled" }) {
  useEffect(() => {
    if (window.parent === window) return;
    const root = document.querySelector(".embed-root") as HTMLElement | null;
    if (!root) return;
    const send = () =>
      window.parent.postMessage({ type: "booked:height", height: Math.ceil(root.getBoundingClientRect().height) + 2 }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(root);
    send();
    if (event) window.parent.postMessage({ type: `booked:${event}` }, "*");
    return () => ro.disconnect();
  }, [event]);
  return null;
}
