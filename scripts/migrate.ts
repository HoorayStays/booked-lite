/**
 * Creates / updates the database tables. Runs automatically before `npm run dev`
 * and `npm run build` (so every Vercel deploy keeps the database up to date).
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";

async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:.data/local.db";
  if (process.env.VERCEL && url.startsWith("file:")) {
    console.error(
      "\n✖ DATABASE_URL is not set in Vercel. Add your Turso database URL and token in\n" +
        "  Vercel → your project → Settings → Environment Variables, then redeploy.\n",
    );
    process.exit(1);
  }
  if (url.startsWith("file:")) fs.mkdirSync(".data", { recursive: true });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  client.close();
  console.log(`✓ Database is up to date (${url.startsWith("file:") ? url : "Turso"})`);
}

main().catch((err) => {
  console.error("✖ Database migration failed:", err?.message ?? err);
  console.error("  Check DATABASE_URL and DATABASE_AUTH_TOKEN (see SETUP.md → Troubleshooting).");
  process.exit(1);
});
