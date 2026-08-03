/**
 * Invoice commitments — the fingerprint that goes on-chain.
 *
 * The chain stores one felt per invoice and nothing else. That felt is a
 * Poseidon hash over the invoice's economic terms plus a random salt. It
 * discloses nothing on its own: without the salt, an observer who *guessed*
 * the amount and both addresses could otherwise confirm the guess by
 * recomputing the hash, which would make the commitment a lookup table rather
 * than a seal.
 *
 * What the anchor actually proves is **immutability, not truth**. The registry
 * records whatever the issuer commits to; it cannot know whether the bolts were
 * delivered. What it does guarantee is that neither party can alter the invoice
 * afterwards and claim it always read that way — the commitment was fixed at a
 * known block, and the plaintext either reproduces it or it does not.
 *
 * Poseidon (not Pedersen or keccak) because Cairo's `poseidon_hash_span` is the
 * native counterpart, so a contract can recompute a commitment cheaply if a
 * later version ever needs to.
 */
import { hash, num } from "starknet";

import type { Invoice, InvoiceLineItem, InvoiceParty } from "./types";

/** Bits of randomness in an invoice id. Comfortably collision-free, one felt. */
const ID_BITS = 128;
/** Salt gets the full 251-bit felt range minus a safety margin. */
const SALT_BITS = 248;

function randomHex(bits: number): string {
  const bytes = new Uint8Array(bits / 8);
  globalThis.crypto.getRandomValues(bytes);
  let out = "0x";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return num.toHex(BigInt(out));
}

/** A fresh 128-bit invoice id. */
export function generateInvoiceId(): string {
  return randomHex(ID_BITS);
}

/** A fresh commitment salt. */
export function generateSalt(): string {
  return randomHex(SALT_BITS);
}

/**
 * Deterministic JSON. `JSON.stringify` preserves insertion order, so two
 * objects with identical contents but different key order would hash
 * differently — and the invoice round-trips through a database and a
 * decryption step before anyone recomputes its commitment.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
    .join(",")}}`;
}

/**
 * SHA-256 a string into two 128-bit felts (high, low).
 *
 * Free-text fields — party names, line-item descriptions, notes — have no
 * length bound, so they cannot go into Poseidon directly as short strings
 * (which cap at 31 bytes). Digesting first gives a fixed-width input, and
 * splitting at 128 bits keeps both halves well inside the felt range.
 */
async function digestToFelts(text: string): Promise<[string, string]> {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", bytes),
  );
  let high = 0n;
  let low = 0n;
  for (let index = 0; index < 16; index += 1) {
    high = (high << 8n) | BigInt(digest[index]);
    low = (low << 8n) | BigInt(digest[index + 16]);
  }
  return [num.toHex(high), num.toHex(low)];
}

/** The free-text half of an invoice, hashed to a fixed-width digest. */
function documentText(invoice: Invoice): string {
  const party = (partyValue: InvoiceParty) => ({
    name: partyValue.name,
    address: partyValue.address,
    taxId: partyValue.taxId ?? "",
  });
  const line = (item: InvoiceLineItem) => ({
    description: item.description,
    quantity: item.quantity,
    amountRaw: item.amountRaw,
  });
  return canonicalize({
    supplier: party(invoice.supplier),
    buyer: party(invoice.buyer),
    reference: invoice.reference,
    lineItems: invoice.lineItems.map(line),
    notes: invoice.notes,
  });
}

/**
 * The invoice commitment.
 *
 * Economic terms go in as felts directly so their contribution is legible;
 * everything free-text is folded in through one SHA-256 digest. Changing any
 * field — a digit of the amount, a character of a line item — changes the
 * commitment, and the anchored invoice stops verifying.
 */
export async function invoiceCommitment(invoice: Invoice): Promise<string> {
  const [textHigh, textLow] = await digestToFelts(documentText(invoice));
  return hash.computePoseidonHashOnElements([
    invoice.id,
    invoice.supplier.address,
    invoice.buyer.address,
    invoice.tokenAddress,
    num.toHex(BigInt(invoice.amountRaw)),
    num.toHex(BigInt(invoice.issuedAt)),
    num.toHex(BigInt(invoice.dueAt)),
    textHigh,
    textLow,
    invoice.salt,
  ]);
}

/**
 * The settlement commitment, written by the registry when the buyer pays.
 *
 * Binds the payment to the invoice *and* to who paid it, so a third party
 * holding the plaintext can confirm that this particular buyer settled this
 * particular invoice — while the chain shows only an opaque felt.
 */
export async function paymentCommitment(
  invoice: Invoice,
  payerAddress: string,
): Promise<string> {
  const commitment = await invoiceCommitment(invoice);
  return hash.computePoseidonHashOnElements([
    commitment,
    payerAddress,
    num.toHex(BigInt(invoice.amountRaw)),
    invoice.salt,
  ]);
}

/**
 * Check a plaintext invoice against an anchored commitment.
 *
 * Compares numerically — `0x0a…` and `0xa…` are the same felt, and a string
 * comparison would report a valid invoice as forged.
 */
export async function verifyCommitment(
  invoice: Invoice,
  anchoredCommitment: string,
): Promise<boolean> {
  try {
    const recomputed = await invoiceCommitment(invoice);
    return num.toBigInt(recomputed) === num.toBigInt(anchoredCommitment);
  } catch {
    return false;
  }
}
