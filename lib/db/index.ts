import "server-only";

/**
 * Server-only database entry point. Importing this from a Client Component fails
 * the build rather than leaking a Node-only module into the browser bundle.
 *
 * Node scripts (ingestion, seeding) must import `./connection` directly —
 * `server-only` throws outside a React Server Component graph, which includes
 * anything run under tsx.
 */
export { db, pool, schema } from "./connection";
export * from "./schema";
