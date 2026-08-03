/**
 * Validated environment variables.
 *
 * `publicEnv` holds `NEXT_PUBLIC_*` values — inlined into the client bundle,
 * safe in the browser. `getServerEnv()` holds server-only values (secrets) —
 * never read it from client code; on the client those values are `undefined`.
 *
 * A missing/invalid variable fails fast with a clear zod error rather than
 * surfacing as a confusing runtime bug later.
 */

import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  /**
   * Alchemy Starknet API key. Only the key, not a full URL — the RPC endpoints
   * in `src/lib/starknet/networks.ts` append it. Public by necessity: the
   * browser talks to the node directly to read receipts and shielded balances.
   *
   * Allowed to be empty. A missing key must not stop the app from rendering —
   * it only means on-chain calls will fail, and `isProviderConfigured()` in
   * `networks.ts` turns that into a message at the point of use rather than a
   * blank screen at boot.
   */
  NEXT_PUBLIC_PROVIDER_URL: z.string().optional(),
  /**
   * Deployed `InvoiceRegistry` address per network. "0x0" (the default) means
   * "not deployed here" — the UI disables on-chain anchoring on that network
   * rather than sending a doomed transaction.
   */
  NEXT_PUBLIC_INVOICE_REGISTRY_MAINNET: z.string().optional(),
  NEXT_PUBLIC_INVOICE_REGISTRY_SEPOLIA: z.string().optional(),
  /**
   * STRK20 privacy pool address per network. Only used to read whether a payee
   * has registered a viewing key — the wallet supplies this address itself when
   * sending. "0x0" disables the pre-flight check.
   */
  NEXT_PUBLIC_STRK20_POOL_MAINNET: z.string().optional(),
  NEXT_PUBLIC_STRK20_POOL_SEPOLIA: z.string().optional(),
});

const serverSchema = z.object({
  /** Optional upstream the contact endpoint forwards leads to (CRM / webhook). */
  CONTACT_ENDPOINT: z.url().optional(),
  /**
   * Neon Postgres connection string. Holds *encrypted* invoice blobs only —
   * the decryption key never leaves the browser, so a database dump discloses
   * nothing.
   */
  DATABASE_URL: z.string().min(1),
});

/** Public env — safe to read anywhere (server or client). */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_PROVIDER_URL: process.env.NEXT_PUBLIC_PROVIDER_URL,
  NEXT_PUBLIC_INVOICE_REGISTRY_MAINNET:
    process.env.NEXT_PUBLIC_INVOICE_REGISTRY_MAINNET,
  NEXT_PUBLIC_INVOICE_REGISTRY_SEPOLIA:
    process.env.NEXT_PUBLIC_INVOICE_REGISTRY_SEPOLIA,
  NEXT_PUBLIC_STRK20_POOL_MAINNET: process.env.NEXT_PUBLIC_STRK20_POOL_MAINNET,
  NEXT_PUBLIC_STRK20_POOL_SEPOLIA: process.env.NEXT_PUBLIC_STRK20_POOL_SEPOLIA,
});

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/**
 * Server-only env. Call from route handlers / server code only — parsed
 * lazily so the client bundle never evaluates it.
 */
export function getServerEnv() {
  cachedServerEnv ??= serverSchema.parse({
    CONTACT_ENDPOINT: process.env.CONTACT_ENDPOINT,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  return cachedServerEnv;
}
