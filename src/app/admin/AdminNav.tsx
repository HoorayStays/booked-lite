"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Bookings" },
  { href: "/admin/events", label: "Event types" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/settings", label: "Branding & calendar" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Admin">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
