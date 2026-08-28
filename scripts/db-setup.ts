import "dotenv/config";
import { Pool } from "pg";

/**
 * Enables pgvector.
 *
 * NOT needed for `pnpm db:migrate` — the first migration creates the extension
 * itself, so a fresh clone works with `db:up` then `db:migrate` alone.
 *
 * This exists for the `db:push` path: drizzle-kit push applies DDL directly from
 * the schema and never reads migration files, so it would hit `type "vector" does
 * not exist` on a database where the extension was never enabled.
 *
 * Idempotent — safe to run any time.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

try {
  await pool.query("create extension if not exists vector");
  const { rows } = await pool.query(
    "select extversion from pg_extension where extname = 'vector'",
  );
  console.log(`pgvector ready (v${rows[0]?.extversion ?? "unknown"})`);
} finally {
  await pool.end();
}
