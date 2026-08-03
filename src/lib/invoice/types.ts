/**
 * The invoice document.
 *
 * This is the plaintext that never reaches the server. It is encrypted in the
 * issuer's browser, stored as an opaque blob, and decrypted again only by
 * someone holding the key from the invoice link.
 *
 * Money is carried as `amountRaw` — a decimal string of the smallest-unit
 * `bigint`, not a `number`. A JS number silently loses precision above 2^53,
 * which for an 18-decimal token starts at about 0.009 tokens, and the value is
 * hashed into a commitment where a one-wei difference means the invoice no
 * longer verifies.
 */
import type { NetworkKey } from "@/lib/starknet/networks";

export interface InvoiceLineItem {
  description: string;
  /** Free-form: "200,000 units", "40 hours". Display only. */
  quantity: string;
  /** Line total in the smallest unit, as a decimal string. */
  amountRaw: string;
}

export interface InvoiceParty {
  /** Legal or trading name, e.g. "Acme Bolts GmbH". */
  name: string;
  /** Starknet address that pays or gets paid. */
  address: string;
  /** Optional tax id / company number, for the auditor's benefit. */
  taxId?: string;
}

/** What the issuer fills in. */
export interface InvoiceDraft {
  supplier: InvoiceParty;
  buyer: InvoiceParty;
  /** The supplier's own invoice or PO number. */
  reference: string;
  /** Total payable, smallest unit, decimal string. */
  amountRaw: string;
  /** Unix seconds. */
  issuedAt: number;
  /** Unix seconds. Payment is late after this. */
  dueAt: number;
  lineItems: InvoiceLineItem[];
  notes: string;
}

/** A draft, plus the identifiers fixed at issue time. */
export interface Invoice extends InvoiceDraft {
  /** 128-bit random id, hex, one felt. Also the database primary key. */
  id: string;
  /**
   * Random felt mixed into the commitment. Without it, an observer who guessed
   * the amount and both addresses could confirm the guess by recomputing the
   * hash — the commitment would be a lookup table, not a seal.
   */
  salt: string;
  network: NetworkKey;
  tokenAddress: string;
  tokenDecimals: number;
  tokenSymbol: string;
}

export type InvoiceStatus = "awaiting" | "paid" | "overdue";

/** Server-visible record. Deliberately holds nothing readable. */
export interface InvoiceRecord {
  id: string;
  /** AES-GCM ciphertext of the `Invoice`, base64url. */
  ciphertext: string;
  /** 12-byte AES-GCM nonce, base64url. */
  iv: string;
  /** Poseidon commitment anchored on-chain. */
  commitment: string;
  network: NetworkKey;
  /** Registry anchor transaction, once confirmed. */
  anchorTxHash: string | null;
  /** Settlement transaction, once the buyer pays. */
  settlementTxHash: string | null;
  paidAt: number | null;
  createdAt: number;
}

/**
 * What an auditor is handed: the plaintext invoice, plus everything needed to
 * check it against the chain without being given the invoice link (and with it
 * the ability to read future revisions).
 */
export interface DisclosurePacket {
  invoice: Invoice;
  commitment: string;
  anchorTxHash: string | null;
  settlementTxHash: string | null;
  paidAt: number | null;
}
