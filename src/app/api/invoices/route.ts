import { ApiError, handle } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import { createInvoiceSchema } from "@/lib/invoice/schemas";

/**
 * Store an encrypted invoice.
 *
 * The body is opaque by design — this handler validates its *shape* and never
 * learns its contents. There is no auth: the invoice id is 128 bits of
 * client-side randomness, so knowing one is the credential, and the ciphertext
 * is useless without the key that rides in the link fragment.
 */
export const POST = handle(async (req) => {
  const input = createInvoiceSchema.parse(await req.json());
  const db = getDb();

  // An id collision is a 2^-128 event, so in practice this only fires when the
  // same invoice is submitted twice. Failing is right either way: overwriting
  // would let anyone holding an id replace an invoice that was already sent.
  const [row] = await db
    .insert(invoices)
    .values({
      id: input.id,
      ciphertext: input.ciphertext,
      iv: input.iv,
      commitment: input.commitment,
      network: input.network,
      anchorTxHash: input.anchorTxHash ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: invoices.id, createdAt: invoices.createdAt });

  if (!row) {
    throw new ApiError(409, "already_exists", "That invoice id is already in use.");
  }

  return { id: row.id, createdAt: row.createdAt.toISOString() };
});
