"use client";

/**
 * The local key vault.
 *
 * Because the server stores no party addresses, it cannot answer "show me my
 * invoices" — that would require it to know who you are, which is the exact
 * thing the schema refuses to record. So the index lives here, in the browser
 * that issued or paid each invoice.
 *
 * **This is genuinely sensitive.** It holds every decryption key this browser
 * has seen. Anyone with access to the browser profile can read every invoice in
 * it. That is the honest cost of having no accounts and no server-side key
 * escrow: there is nobody to ask for a password reset, and losing the profile
 * loses the index (though never an invoice — the link still opens it).
 *
 * Failures are swallowed rather than thrown. `localStorage` is unavailable in
 * private modes and over-quota browsers, and a dashboard that cannot list is a
 * degraded feature; a payment page that crashes on boot is a broken product.
 */
import type { NetworkKey } from "@/lib/starknet/networks";

const STORAGE_KEY = "vellum.vault.v1";

export type VaultRole = "issuer" | "payer";

export interface VaultEntry {
  /** Invoice id — the primary key everywhere. */
  id: string;
  /** base64url AES-GCM key, as it appears in the link fragment. */
  key: string;
  /** Whether this browser issued the invoice or received it. */
  role: VaultRole;
  network: NetworkKey;
  /** Unix ms this entry was saved. Drives the dashboard's default order. */
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readVault(): VaultEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter rather than trust: this is user-writable storage, and one hand-edited
    // entry should not take the whole dashboard down.
    return parsed.filter(
      (entry): entry is VaultEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as VaultEntry).id === "string" &&
        typeof (entry as VaultEntry).key === "string",
    );
  } catch {
    return [];
  }
}

function writeVault(entries: VaultEntry[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Over quota or storage disabled — the invoice itself is safe on the
    // server, and its link still opens it.
  }
}

/** Add an invoice, or refresh what we know about one already held. */
export function rememberInvoice(entry: Omit<VaultEntry, "savedAt">): void {
  const entries = readVault();
  const existing = entries.findIndex((row) => row.id === entry.id);
  const next: VaultEntry = { ...entry, savedAt: Date.now() };

  if (existing >= 0) {
    // Keep the original savedAt so paying an invoice does not reshuffle the
    // dashboard, but let `role` upgrade: issuing then paying your own test
    // invoice should still read as "issuer".
    next.savedAt = entries[existing].savedAt;
    next.role = entries[existing].role === "issuer" ? "issuer" : entry.role;
    entries[existing] = next;
  } else {
    entries.push(next);
  }
  writeVault(entries);
}

export function findInvoiceKey(id: string): VaultEntry | undefined {
  return readVault().find((entry) => entry.id === id);
}

export function forgetInvoice(id: string): void {
  writeVault(readVault().filter((entry) => entry.id !== id));
}

/** Newest first. */
export function listInvoices(): VaultEntry[] {
  return readVault().sort((left, right) => right.savedAt - left.savedAt);
}
