/**
 * Reading the `InvoiceRegistry` on-chain.
 *
 * This module exists because everything else in the app learns about an
 * invoice from our own database, and a database is exactly the thing an
 * auditor has no reason to trust. The disclosure page's whole claim — that a
 * document was fixed at a known time and never edited — is only worth
 * something if the commitment it checks against came from a chain rather than
 * from us.
 *
 * So the result type distinguishes "the chain says no anchor exists" from "we
 * could not ask the chain". They look the same to a naive caller and mean
 * opposite things: the first is evidence, the second is ignorance, and a UI
 * that renders ignorance as evidence is the failure this module is here to
 * prevent.
 */
import { CallData, num, type Call } from "starknet";

import { hasRegistry, isProviderConfigured, providerFor, type NetworkConfig } from "./networks";

/** Mirrors `InvoiceAnchor` in `cairo/src/lib.cairo`. */
export interface OnChainAnchor {
  commitment: string;
  /** Unix seconds the commitment was fixed. */
  anchoredAt: number;
  /** Null until settled. */
  paymentCommitment: string | null;
  /** Unix seconds of settlement, null until settled. */
  paidAt: number | null;
}

export type AnchorLookup =
  /** We could not ask. Says nothing about whether an anchor exists. */
  | { status: "unavailable"; reason: "no-registry" | "no-provider" }
  /** The chain answered: this invoice id has no anchor. */
  | { status: "absent" }
  /** The chain answered with an anchor. */
  | { status: "found"; anchor: OnChainAnchor }
  /** The call failed. Also not evidence of absence. */
  | { status: "error"; message: string };

/**
 * Fetch an invoice's anchor from the registry.
 *
 * Never throws — every failure is a variant, because the caller's job is to
 * render the difference between them rather than to catch.
 */
export async function readAnchor(
  network: NetworkConfig,
  invoiceId: string,
): Promise<AnchorLookup> {
  if (!hasRegistry(network)) {
    return { status: "unavailable", reason: "no-registry" };
  }
  if (!isProviderConfigured()) {
    return { status: "unavailable", reason: "no-provider" };
  }

  try {
    const result = await providerFor(network.key).callContract({
      contractAddress: network.registryAddress,
      entrypoint: "get_invoice",
      calldata: CallData.compile([invoiceId]),
    });

    // InvoiceAnchor serialises as four felts, in declaration order.
    if (result.length < 4) {
      return {
        status: "error",
        message: `Registry returned ${result.length} values, expected 4.`,
      };
    }

    const commitment = num.toHex(result[0]);
    const anchoredAt = Number(num.toBigInt(result[1]));
    const paymentCommitment = num.toBigInt(result[2]);
    const paidAt = Number(num.toBigInt(result[3]));

    // A zero commitment is the contract's own "never anchored" sentinel — the
    // storage map returns a zeroed struct for an unknown key.
    if (num.toBigInt(commitment) === 0n) {
      return { status: "absent" };
    }

    return {
      status: "found",
      anchor: {
        commitment,
        anchoredAt,
        // Presence is tested on the commitment, not the timestamp — a block
        // timestamp of zero is a legitimate value and would read as unpaid.
        paymentCommitment: paymentCommitment === 0n ? null : num.toHex(paymentCommitment),
        paidAt: paymentCommitment === 0n ? null : paidAt,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Whether a lookup actually establishes anything about the chain's contents. */
export function isChainEvidence(lookup: AnchorLookup): boolean {
  return lookup.status === "found" || lookup.status === "absent";
}

/**
 * Build the call that fixes an invoice's commitment ahead of payment.
 *
 * Mirrors `IInvoiceRegistry::anchor_invoice` in `cairo/src/lib.cairo`. Unlike
 * settlement, this is an ordinary public invoke — not a privacy-pool action —
 * so it goes through the connected wallet's plain `execute`, not
 * `strk20InvokeTransaction`. See `submitInvoke` in `./submit`.
 */
export function anchorInvoiceCall(
  network: NetworkConfig,
  invoiceId: string,
  commitment: string,
): Call {
  return {
    contractAddress: network.registryAddress,
    entrypoint: "anchor_invoice",
    calldata: CallData.compile([num.toHex(invoiceId), num.toHex(commitment)]),
  };
}

/** Numeric felt comparison — `0x0a…` and `0xa…` are the same value. */
function sameFelt(left: string, right: string): boolean {
  try {
    return num.toBigInt(left) === num.toBigInt(right);
  } catch {
    return false;
  }
}

/** Which of the two commitments the registry ended up holding. */
export type AnchorKind =
  /** Written by the issuer before payment: a hash of the terms alone. */
  | "invoice"
  /**
   * Written by settlement because the invoice was never anchored early. Binds
   * the terms *and* the payer, so it proves strictly more.
   */
  | "payment"
  | "neither";

/**
 * Check a document against what the registry holds.
 *
 * Two commitments can legitimately be stored, and which one it is depends on a
 * choice the issuer made days earlier. `anchor_invoice` writes a hash of the
 * terms; settling an invoice that was never anchored writes the payment
 * commitment instead, because that is the only value the buyer's transaction
 * carries.
 *
 * Both are valid records of the same document, so both are accepted. Comparing
 * against only one of them reports a correctly paid invoice as a forgery —
 * which is a far worse failure on this page than saying nothing at all.
 */
export function anchorMatches(
  anchor: OnChainAnchor,
  recomputedInvoiceCommitment: string,
  recomputedPaymentCommitment?: string,
): AnchorKind {
  if (sameFelt(anchor.commitment, recomputedInvoiceCommitment)) return "invoice";
  if (
    recomputedPaymentCommitment &&
    sameFelt(anchor.commitment, recomputedPaymentCommitment)
  ) {
    return "payment";
  }
  return "neither";
}
