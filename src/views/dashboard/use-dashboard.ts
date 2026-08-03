"use client";

/**
 * Loads this browser's invoice index and turns it into rows.
 *
 * The vault only knows `{id, key, role}` — everything else (amount, parties,
 * status) lives in the ciphertext, so every row needs its own fetch + decrypt
 * before it has anything to show. Those run concurrently via
 * `Promise.allSettled`: a dashboard that waits on invoice #1 before starting
 * invoice #2 would make "how many invoices do you have" the thing that
 * decides how slow this page feels. `allSettled` (not `all`) matters just as
 * much — one bad ciphertext or a stale key must not stop the rest of the rows
 * from resolving.
 */
import { useEffect, useState } from "react";

import { fetchInvoice, InvoiceApiError } from "@/lib/invoice/api";
import { decryptInvoice, importInvoiceKey } from "@/lib/invoice/crypto";
import type { StoredInvoice } from "@/lib/invoice/schemas";
import type { Invoice } from "@/lib/invoice/types";
import {
  forgetInvoice as forgetFromVault,
  listInvoices,
  type VaultEntry,
} from "@/lib/invoice/vault";

export interface ReadyRow {
  status: "ready";
  entry: VaultEntry;
  invoice: Invoice;
  stored: StoredInvoice;
}

export interface PendingRow {
  status: "loading";
  entry: VaultEntry;
}

export interface FailedRow {
  status: "error";
  entry: VaultEntry;
  message: string;
}

export type DashboardRow = ReadyRow | PendingRow | FailedRow;

async function loadOne(
  entry: VaultEntry,
): Promise<{ invoice: Invoice; stored: StoredInvoice }> {
  const stored = await fetchInvoice(entry.id);
  const key = await importInvoiceKey(entry.key);
  const invoice = await decryptInvoice(stored, key);
  return { invoice, stored };
}

/** `reason` is whatever the failed promise threw — `unknown` by definition. */
function describeFailure(reason: unknown): string {
  if (reason instanceof InvoiceApiError) {
    return reason.code === "not_found"
      ? "This invoice is no longer on the server."
      : reason.message;
  }
  // A wrong or malformed key fails AES-GCM's auth tag, which surfaces as a
  // generic DOMException with nothing app-specific to branch on.
  return "Could not decrypt this invoice — the saved key may not match it.";
}

export function useDashboard() {
  // `null` until the vault has been read once — distinguishes "we don't know
  // yet" from "we checked and there is nothing", which matters because those
  // two states should not render the same way.
  const [rows, setRows] = useState<DashboardRow[] | null>(null);

  useEffect(() => {
    const entries = listInvoices();
    setRows(entries.map((entry) => ({ status: "loading", entry })));
    if (entries.length === 0) return;

    let cancelled = false;
    Promise.allSettled(entries.map(loadOne)).then((results) => {
      if (cancelled) return;
      setRows(
        entries.map((entry, index) => {
          const result = results[index];
          return result.status === "fulfilled"
            ? ({ status: "ready", entry, ...result.value } satisfies ReadyRow)
            : ({
                status: "error",
                entry,
                message: describeFailure(result.reason),
              } satisfies FailedRow);
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const forget = (id: string) => {
    forgetFromVault(id);
    setRows((prev) => (prev ? prev.filter((row) => row.entry.id !== id) : prev));
  };

  return { rows, forget };
}
