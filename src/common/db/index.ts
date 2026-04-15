import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,       // close idle connections after 10s 
  connectionTimeoutMillis: 10000, // wait up to 10s to get a connection
  keepAlive: true,                // send TCP keepalive packets to detect dead connections
});

// Handle connection errors gracefully — prevents server crash on dropped connections
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

// Verify connection at startup — fail fast rather than serving with a broken DB
pool.connect((err, _client, release) => {
  if (err) {
    console.error("[DB] Failed to connect:", err.message);
    process.exit(1);
  }
  release();
  console.log(`[DB] Connected successfully (${env.NODE_ENV})`);
});

// Graceful shutdown — Railway and Render both send SIGTERM before killing the process.
// Without this, in-flight DB connections are dropped ungracefully.
const shutdown = async (signal: string) => {
  console.log(`[DB] ${signal} received — closing pool...`);
  await pool.end();
  console.log("[DB] Pool closed. Exiting.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export const db = drizzle(pool, { schema });
export { pool };