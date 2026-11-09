import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __bookedDb?: DB; __bookedClient?: Client };

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:.data/local.db";
}

/** One shared connection per server instance. */
export function getDb(): DB {
  if (!globalForDb.__bookedDb) {
    const client = createClient({
      url: databaseUrl(),
      authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined,
    });
    globalForDb.__bookedClient = client;
    globalForDb.__bookedDb = drizzle(client, { schema });
  }
  return globalForDb.__bookedDb;
}

export { schema };
