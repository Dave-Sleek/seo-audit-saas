// app/db/index.ts

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

/*
 * The Neon serverless driver uses WebSockets for its
 * connection pool. In Node.js (which is what Next.js server
 * code runs on), we have to tell it to use the `ws` package.
 *
 * On edge/serverless runtimes this is done automatically by
 * the framework. In plain Node, it's not — so we set it here.
 */
neonConfig.webSocketConstructor = ws;

/*
 * In development, Next.js hot-reloads modules on every save.
 * Without caching the pool on globalThis, each save would
 * create a new pool and orphan the old connections, causing
 * every request after a hot reload to open a fresh TCP
 * connection (1-2 seconds each).
 *
 * In production, this caching is harmless — the module is
 * only evaluated once, so the global lookup always finds
 * the fresh pool or creates it.
 */
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });