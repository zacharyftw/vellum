"use client";

/**
 * The disclosure flow: read the key out of the link, fetch the ciphertext,
 * decrypt it, and check the plaintext against what was anchored.
 *
 * Each way this can fail to end in a readable invoice gets its own phase
 * rather than one generic "error" — a missing key, a 404, and a failed
 * decryption are different situations for the person reading this page, and
 * collapsing them would make the two that matter most (a wrong key vs. a
 * genuinely tampered record) look the same as a typo in the URL.
 *
 * `verified` and a commitment mismatch are deliberately *not* failure phases:
 * a mismatch is still something to show, in full, with the discrepancy made
 * unambiguous — hiding the document because it failed to verify would be
 * worse than showing it with a loud warning.
 */
import { useEffect, useState } from "react";

import { InvoiceApiError, fetchInvoice } from "@/lib/invoice/api";
import {
  invoiceCommitment,
  paymentCommitment,
  verifyCommitment,
} from "@/lib/invoice/commitment";
import { decryptInvoice, importInvoiceKey, readKeyFromFragment } from "@/lib/invoice/crypto";
import type { StoredInvoice } from "@/lib/invoice/schemas";
import type { Invoice } from "@/lib/invoice/types";
import { NETWORKS } from "@/lib/starknet/networks";
import {
  anchorMatches,
  readAnchor,
  type AnchorKind,
  type AnchorLookup,
} from "@/lib/starknet/registry";

export type DisclosureState =
  | { phase: "loading" }
  | { phase: "no-key" }
  | { phase: "not-found" }
  | { phase: "load-error"; message: string }
  | { phase: "undecryptable" }
  | {
      phase: "ready";
      invoice: Invoice;
      stored: StoredInvoice;
      /**
       * Whether the plaintext reproduces the commitment **Vellum recorded**.
       * This is a consistency check against our own database, not proof of
       * anything an auditor should rely on alone — a compromised server could
       * store a commitment for a forged document and this would still be true.
       */
      matchesRecord: boolean;
      /** Recomputed from the plaintext, shown alongside both other values. */
      recomputedCommitment: string;
      /** What the registry contract actually returned, if we could ask it. */
      chain: AnchorLookup;
      /**
       * The only claim worth an auditor's trust: the plaintext reproduces a
       * commitment read back off the chain. Null when the chain could not be
       * consulted, which is deliberately not `false`.
       */
      matchesChain: boolean | null;
      /**
       * Which commitment the registry holds — the terms alone, or the terms
       * bound to the payer. `null` when the chain could not be consulted.
       */
      anchorKind: AnchorKind | null;
    };

export function useDisclosure(id: string): DisclosureState {
  const [state, setState] = useState<DisclosureState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });

    (async () => {
      const key = readKeyFromFragment(window.location.hash);
      if (!key) {
        if (!cancelled) setState({ phase: "no-key" });
        return;
      }

      let stored: StoredInvoice;
      try {
        stored = await fetchInvoice(id);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof InvoiceApiError && error.code === "not_found") {
          setState({ phase: "not-found" });
        } else {
          setState({
            phase: "load-error",
            message:
              error instanceof Error
                ? error.message
                : "The invoice could not be loaded.",
          });
        }
        return;
      }

      let invoice: Invoice;
      try {
        const cryptoKey = await importInvoiceKey(key);
        invoice = await decryptInvoice(
          { ciphertext: stored.ciphertext, iv: stored.iv },
          cryptoKey,
        );
      } catch {
        // AES-GCM fails closed on a wrong key and on a tampered ciphertext
        // alike — there is no signal here to tell those two apart.
        if (!cancelled) setState({ phase: "undecryptable" });
        return;
      }

      // The payment commitment is recomputed against the *invoice's* buyer.
      // Settlement by anyone else would not reproduce it — which is a genuine
      // mismatch worth reporting, not a false alarm.
      const [matchesRecord, recomputedCommitment, recomputedPayment, chain] =
        await Promise.all([
          verifyCommitment(invoice, stored.commitment),
          invoiceCommitment(invoice),
          paymentCommitment(invoice, invoice.buyer.address),
          readAnchor(NETWORKS[stored.network], stored.id),
        ]);

      // Null, not false, when the chain could not be consulted. Collapsing the
      // two would let "we could not ask" render as "it does not match", which
      // is the same overclaiming error in the opposite direction.
      const anchorKind =
        chain.status === "found"
          ? anchorMatches(chain.anchor, recomputedCommitment, recomputedPayment)
          : chain.status === "absent"
            ? "neither"
            : null;

      const matchesChain = anchorKind === null ? null : anchorKind !== "neither";

      if (!cancelled) {
        setState({
          phase: "ready",
          invoice,
          stored,
          matchesRecord,
          recomputedCommitment,
          chain,
          matchesChain,
          anchorKind,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
