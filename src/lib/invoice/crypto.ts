/**
 * Invoice encryption.
 *
 * An invoice is encrypted in the issuer's browser with a key that is generated
 * there and never transmitted. The ciphertext goes to the server; the key is
 * placed in the **fragment** of the invoice link.
 *
 * The fragment is what makes this work: browsers do not send anything after
 * `#` in an HTTP request. It stays out of the request line, out of server
 * logs, out of the `Referer` header, and out of any proxy in between. The
 * server can therefore hold every invoice ever issued and still be unable to
 * read one — which is the property that lets a supplier put their whole order
 * book here without handing it to us.
 *
 * AES-GCM because it authenticates as well as encrypts: a tampered ciphertext
 * fails to decrypt rather than yielding plausible garbage.
 */
import type { Invoice } from "./types";

const ALGORITHM = "AES-GCM";
const KEY_BITS = 256;
/** 96 bits is the size AES-GCM is specified and analysed for. */
const IV_BYTES = 12;

export interface EncryptedInvoice {
  ciphertext: string;
  iv: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns `Uint8Array<ArrayBuffer>`, not plain `Uint8Array`: Web Crypto's
// `BufferSource` excludes views backed by a `SharedArrayBuffer`, and the
// default `Uint8Array` type admits one.
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** A fresh, extractable invoice key. Extractable so it can go in the link. */
export async function generateInvoiceKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_BITS },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Export a key as the base64url string that rides in the link fragment. */
export async function exportInvoiceKey(key: CryptoKey): Promise<string> {
  const raw = await globalThis.crypto.subtle.exportKey("raw", key);
  return toBase64Url(new Uint8Array(raw));
}

/** Import a key from its base64url form. Throws if the string is malformed. */
export async function importInvoiceKey(encoded: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    fromBase64Url(encoded),
    { name: ALGORITHM },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptInvoice(
  invoice: Invoice,
  key: CryptoKey,
): Promise<EncryptedInvoice> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(invoice));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    plaintext,
  );
  return {
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
  };
}

/**
 * Decrypt an invoice.
 *
 * Throws when the key is wrong or the ciphertext was altered — GCM's
 * authentication tag fails closed, so there is no "decrypted but corrupt"
 * state to guard against downstream.
 */
export async function decryptInvoice(
  encrypted: EncryptedInvoice,
  key: CryptoKey,
): Promise<Invoice> {
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64Url(encrypted.iv) },
    key,
    fromBase64Url(encrypted.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as Invoice;
}

/**
 * The link the supplier sends the buyer.
 *
 * The key sits after `#`, so it reaches the buyer's browser without ever
 * reaching ours. Anyone who holds this link can read the invoice — treat it
 * like the invoice itself, because it is.
 */
export function buildInvoiceLink(
  origin: string,
  invoiceId: string,
  encodedKey: string,
): string {
  return `${origin}/pay/${invoiceId}#k=${encodedKey}`;
}

/**
 * Read the key out of the current URL fragment.
 *
 * Returns `undefined` rather than throwing: a payment page reached without a
 * key is a normal situation (someone shared the link with the fragment
 * stripped) and deserves an explanation, not a stack trace.
 */
export function readKeyFromFragment(fragment: string): string | undefined {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  return params.get("k") ?? undefined;
}
