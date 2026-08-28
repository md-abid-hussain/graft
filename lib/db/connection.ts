import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * The connection itself, with no `server-only` guard.
 *
 * App and route-handler code should import from `./index` instead, which adds that
 * guard. This module exists so Node scripts (ingestion, seeding) can still reach the
 * database — `server-only` throws outside a React Server Component graph, which
 * includes anything run under tsx.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env");
}

// Cached on globalThis so Next's hot reload does not open a new pool on every
// recompile; without this you exhaust Postgres connections within minutes.
const globalForDb = globalThis as unknown as { __whaPool?: Pool };

const pool =
  globalForDb.__whaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__whaPool = pool;
}

/**
 * `schema` is deliberately NOT passed to drizzle().
 *
 * drizzle-orm v1 removed that option — its config type is
 * `Omit<DrizzleConfig, "schema">` — in favour of the Relations v2 API, where you
 * build a relations object with `defineRelations()` and pass `relations` instead.
 * We have no relational queries yet, so there is nothing to pass.
 *
 * Table-level type safety is unaffected: it comes from the table objects
 * themselves, e.g. `db.select().from(schema.chunks)`, which is why `schema` is
 * re-exported below.
 */
export const db = drizzle({ client: pool });
export { pool, schema };
