import { eq } from "drizzle-orm";

import { ApiError, handle } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { invoices, type InvoiceRow } from "@/lib/db/schema";
import {
  feltHex,
  updateInvoiceSchema,
  type StoredInvoice,
} from "@/lib/invoice/schemas";

/**
 * Read and update one encrypted invoice.
 *
 * Both verbs are unauthenticated, and that is a deliberate consequence of the
 * design rather than an omission: there are no accounts here, and the server
 * cannot tell a supplier from a buyer without learning who they are. The
 * invoice id is the capability — 128 bits, generated in the browser, shared
 * only in the link.
 */

function toStoredInvoice(row: InvoiceRow): StoredInvoice {
  return {
    id: row.id,
    ciphertext: row.ciphertext,
    iv: row.iv,
    commitment: row.commitment,
    network: row.network as StoredInvoice["network"],
    anchorTxHash: row.anchorTxHash,
    settlementTxHash: row.settlementTxHash,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadInvoice(rawId: string): Promise<InvoiceRow> {
  const id = feltHex.parse(rawId);
  const [row] = await getDb()
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "not_found", "No invoice with that id.");
  }
  return row;
}

export const GET = handle(async (_req, ctx) => {
  const { id } = await ctx.params;
  return toStoredInvoice(await loadInvoice(id));
});

/**
 * Record an anchor or settlement transaction hash.
 *
 * This is a **cache, not a source of truth**. Nothing here can distinguish the
 * real payer from anyone who guessed an id, so a client must never treat
 * `paidAt` as proof — `InvoiceRegistry.is_paid` on-chain is the authority, and
 * this only saves the dashboard a node round-trip per row.
 *
 * Both fields are write-once. Letting a second call overwrite a settlement hash
 * would let anyone holding an id point the receipt at an unrelated transaction.
 */
export const PATCH = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = updateInvoiceSchema.parse(await req.json());
  const row = await loadInvoice(id);

  if (input.anchorTxHash && row.anchorTxHash) {
    throw new ApiError(409, "already_anchored", "This invoice already has an anchor.");
  }
  if (input.settlementTxHash && row.settlementTxHash) {
    throw new ApiError(409, "already_settled", "This invoice is already settled.");
  }

  const [updated] = await getDb()
    .update(invoices)
    .set({
      ...(input.anchorTxHash ? { anchorTxHash: input.anchorTxHash } : {}),
      ...(input.settlementTxHash
        ? { settlementTxHash: input.settlementTxHash, paidAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, row.id))
    .returning();

  return toStoredInvoice(updated);
});
