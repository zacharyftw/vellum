import { defineConfig } from "drizzle-kit";

/**
 * Reads `.env.local` explicitly — drizzle-kit runs outside Next.js, so it does
 * not get Next's env loading for free.
 */
process.loadEnvFile?.(".env.local");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
