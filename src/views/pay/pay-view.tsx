"use client";

/**
 * The invoice payment page.
 *
 * Everything here has to be a client leaf: the one piece of data that makes an
 * invoice readable — the decryption key — lives in the URL fragment, and a
 * fragment is invisible to the server by design (see `lib/invoice/crypto.ts`).
 * There is no server-rendered version of this page that could show anything
 * but a shell.
 *
 * The load sequence is a strict pipeline, and each step has exactly one way to
 * fail that matters to the person reading it: no key, no such invoice, wrong
 * key / tampered ciphertext, or some other fetch error. `LoadState` makes each
 * of those its own case rather than a generic "error" string, so the screen
 * can say the true thing instead of a shrug.
 */
import { useCallback, useEffect, useState } from "react";

import { fetchInvoice, InvoiceApiError } from "@/lib/invoice/api";
import { verifyCommitment } from "@/lib/invoice/commitment";
import { decryptInvoice, importInvoiceKey, readKeyFromFragment } from "@/lib/invoice/crypto";
import type { StoredInvoice } from "@/lib/invoice/schemas";
import { invoiceStatus } from "@/lib/invoice/status";
import type { Invoice } from "@/lib/invoice/types";
import { NETWORKS } from "@/lib/starknet/networks";

import { FadeIn } from "./fade-in";
import { InvoiceDocument } from "./invoice-document";
import { PaymentPanel } from "./payment-panel";
import { ReceiptPanel } from "./receipt-panel";
import {
  DecryptFailedScreen,
  LoadErrorScreen,
  LoadingScreen,
  NoKeyScreen,
  NotFoundScreen,
} from "./status-screens";

type LoadState =
  | { status: "loading" }
  | { status: "no-key" }
  | { status: "not-found" }
  | { status: "load-error"; message: string }
  | { status: "decrypt-failed" }
  | {
      status: "ready";
      invoice: Invoice;
      stored: StoredInvoice;
      commitmentValid: boolean;
      encodedKey: string;
    };

export interface PayViewProps {
  id: string;
}

export const PayView = ({ id }: PayViewProps) => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });

    // The fragment never reaches the server, so this is the one piece of the
    // pipeline that cannot be a network call — it has to run here, first.
    const encodedKey = readKeyFromFragment(window.location.hash);
    if (!encodedKey) {
      setState({ status: "no-key" });
      return;
    }

    let stored: StoredInvoice;
    try {
      stored = await fetchInvoice(id);
    } catch (error) {
      if (error instanceof InvoiceApiError && error.code === "not_found") {
        setState({ status: "not-found" });
      } else {
        setState({
          status: "load-error",
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
      const key = await importInvoiceKey(encodedKey);
      invoice = await decryptInvoice({ ciphertext: stored.ciphertext, iv: stored.iv }, key);
    } catch {
      // Wrong key or tampered ciphertext look identical from here — AES-GCM's
      // authentication tag fails closed either way, and there is nothing more
      // specific to tell the buyer that would not just be a guess.
      setState({ status: "decrypt-failed" });
      return;
    }

    const commitmentValid = await verifyCommitment(invoice, stored.commitment);
    setState({ status: "ready", invoice, stored, commitmentValid, encodedKey });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main
      // The site header is fixed chrome, not page flow — clearing it takes the
      // header's own offset (hud-y) plus its content box (card-y, doubled for
      // top+bottom) on top of ordinary section breathing room.
      className="min-h-svh px-hud-x pt-[calc(var(--spacing-hud-y)+var(--spacing-card-y)*2+var(--spacing-section))] pb-section max-lg:px-hud-x-sm max-lg:pt-[calc(var(--spacing-hud-y-sm)+var(--spacing-card-y)*2+var(--spacing-section-sm))]"
    >
      <div className="mx-auto w-full max-w-content">
        {state.status === "loading" ? <LoadingScreen /> : null}
        {state.status === "no-key" ? <NoKeyScreen /> : null}
        {state.status === "not-found" ? <NotFoundScreen /> : null}
        {state.status === "decrypt-failed" ? <DecryptFailedScreen /> : null}
        {state.status === "load-error" ? (
          <LoadErrorScreen message={state.message} onRetry={load} />
        ) : null}
        {state.status === "ready" ? (
          <FadeIn className="grid grid-cols-3 items-start gap-hud-gap max-lg:grid-cols-1">
            <div className="col-span-2 max-lg:col-span-1">
              <InvoiceDocument
                invoice={state.invoice}
                status={invoiceStatus({
                  dueAt: state.invoice.dueAt,
                  isPaid: Boolean(state.stored.settlementTxHash),
                })}
                commitmentValid={state.commitmentValid}
              />
            </div>
            <div className="col-span-1">
              {state.stored.settlementTxHash ? (
                <ReceiptPanel
                  stored={state.stored}
                  network={NETWORKS[state.invoice.network]}
                />
              ) : (
                <PaymentPanel
                  id={id}
                  encodedKey={state.encodedKey}
                  invoice={state.invoice}
                  commitmentValid={state.commitmentValid}
                  onSettled={(stored) =>
                    setState((prev) =>
                      prev.status === "ready" ? { ...prev, stored } : prev,
                    )
                  }
                />
              )}
            </div>
          </FadeIn>
        ) : null}
      </div>
    </main>
  );
};
