/**
 * Fresh database + fake calendar for the end-to-end test.
 * Puts a busy block on the fake calendar so the test can check it's respected.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import { DateTime } from "luxon";

for (const f of [".data/e2e.db", ".data/e2e.db-journal", ".data/e2e.db-wal", ".data/e2e-outbox.jsonl", ".data/e2e-calendar.json", ".data/e2e-zoom.json"]) {
  fs.rmSync(f, { force: true });
}
fs.mkdirSync(".data", { recursive: true });
execSync("npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts", { stdio: "inherit", env: process.env });

// Next Tuesday–Thursday at least 3 days out (host timezone America/Chicago).
let day = DateTime.now().setZone("America/Chicago").startOf("day").plus({ days: 3 });
while (![2, 3, 4].includes(day.weekday)) day = day.plus({ days: 1 });
const busyStart = day.set({ hour: 10 });
const busyEnd = day.set({ hour: 12 });

fs.writeFileSync(
  ".data/e2e-calendar.json",
  JSON.stringify({ busy: [{ start: busyStart.toUTC().toISO(), end: busyEnd.toUTC().toISO() }], events: [] }, null, 2),
);
fs.writeFileSync(".data/e2e-meta.json", JSON.stringify({ date: day.toISODate() }));
console.log(`✓ e2e ready: fake busy ${busyStart.toISO()} → ${busyEnd.toISO()}`);
