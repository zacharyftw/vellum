/**
 * Database schema.
 *
 * Read this table as an attacker would: it is the whole of what a dump of our
 * database discloses. Every business fact — amounts, parties, line items, terms
 * — is inside `ciphertext`, and the key to it never reaches this server.
 *
 * What *is* visible here is metadata: that an invoice exists, roughly when it
 * was issued, which network it settles on, and whether it has been paid. That is
 * the honest cost of running a hosted index at all, and it is worth stating
 * plainly rather than implying the server knows nothing.
 *
 * Deliberately absent: any party address. Storing the issuer's address so the
 * dashboard could query by it would rebuild the counterparty graph this product
 * exists to hide — one `SELECT` and you have who trades with whom. The issuer's
 * own browser keeps that index instead (`lib/invoice/vault.ts`).
 */
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const invoices = pgTable(
  "invoices",
  {
    /** 128-bit felt, hex. Generated client-side, unguessable. */
    id: text("id").primaryKey(),

    /** AES-GCM ciphertext of the invoice JSON, base64url. */
    ciphertext: text("ciphertext").notNull(),
    /** 96-bit AES-GCM nonce, base64url. */
    iv: text("iv").notNull(),

    /**
     * The Poseidon commitment anchored on-chain. Stored so a recipient can
     * check the plaintext against it without a node round-trip; the chain
     * remains the authority.
     */
    commitment: text("commitment").notNull(),

    /** "mainnet" | "sepolia". */
    network: text("network").notNull(),

    /** Registry anchor transaction, when the issuer chose to anchor early. */
    anchorTxHash: text("anchor_tx_hash"),

    /**
     * Settlement transaction hash.
     *
     * A convenience cache, never the authority. This endpoint has no way to
     * tell a real payer from anyone who guessed an invoice id, so a write here
     * proves nothing on its own — clients confirm payment against
     * `InvoiceRegistry.is_paid` on-chain.
     */
    settlementTxHash: text("settlement_tx_hash"),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("invoices_created_at_idx").on(table.createdAt)],
);

export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
