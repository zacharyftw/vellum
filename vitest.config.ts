import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure layers — money formatting, commitments, encryption.
 *
 * Node 20+ exposes Web Crypto on `globalThis`, so the invoice crypto runs here
 * unmodified rather than against a mock. Testing a stand-in would prove nothing
 * about the code the buyer's browser actually executes.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
