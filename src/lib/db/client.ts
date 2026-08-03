import "server-only";

/**
 * Database handle.
 *
 * `server-only` at the top is not decoration: it makes an accidental import
 * from a client component a build error rather than a bundle that ships the
 * Neon connection string to the browser.
 *
 * The connection is created lazily so importing this module during a build —
 * or in a route that never queries — does not require `DATABASE_URL` to be set.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getServerEnv } from "@/env";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!cached) {
    cached = drizzle(neon(getServerEnv().DATABASE_URL), { schema });
  }
  return cached;
}
