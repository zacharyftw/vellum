/**
 * Wire schemas, shared by the API routes and the browser client.
 *
 * Every field here arrives from an untrusted caller — the invoice id is public
 * in a link and the endpoints are unauthenticated, so treat all of it as
 * hostile. The bounds are deliberate: without a ciphertext cap, one request can
 * park an arbitrary blob in the database, and this table is meant to hold
 * invoices, not whatever someone felt like uploading.
 */
import { z } from "zod";

/** A felt in hex — invoice ids, commitments, transaction hashes. */
export const feltHex = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/, "Expected a 0x-prefixed hex felt.");

/** base64url, no padding — what `crypto.ts` emits. */
const base64Url = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+$/, "Expected unpadded base64url.");

export const networkKey = z.enum(["mainnet", "sepolia"]);

/**
 * 96-bit nonce → exactly 16 base64url characters. Anything else is not an
 * AES-GCM IV this app produced.
 */
const ivSchema = base64Url(24).length(16);

/**
 * ~48 KB of ciphertext, which is a very long invoice. Generous enough that a
 * real document never hits it, small enough that the endpoint is not storage.
 */
const ciphertextSchema = base64Url(65_536);

export const createInvoiceSchema = z.object({
  id: feltHex,
  ciphertext: ciphertextSchema,
  iv: ivSchema,
  commitment: feltHex,
  network: networkKey,
  /** Set when the issuer anchored the commitment before sending the invoice. */
  anchorTxHash: feltHex.optional(),
});

export const updateInvoiceSchema = z
  .object({
    anchorTxHash: feltHex.optional(),
    settlementTxHash: feltHex.optional(),
  })
  .refine(
    (value) => value.anchorTxHash !== undefined || value.settlementTxHash !== undefined,
    { message: "Provide anchorTxHash or settlementTxHash." },
  );

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

/** What `GET /api/invoices/:id` returns. */
export interface StoredInvoice {
  id: string;
  ciphertext: string;
  iv: string;
  commitment: string;
  network: "mainnet" | "sepolia";
  anchorTxHash: string | null;
  settlementTxHash: string | null;
  paidAt: string | null;
  createdAt: string;
}
