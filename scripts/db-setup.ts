import "dotenv/config";
import { Pool } from "pg";

/**
 * drizzle-kit cannot emit `CREATE EXTENSION`, so pgvector is enabled here.
 * Idempotent — run it before the first `db:push`, and again any time you
 * recreate the container.
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
