/**
 * STRK20 action builders.
 *
 * Every privacy-pool operation is submitted as a list of actions through the
 * connected wallet's `strk20InvokeTransaction`. The wallet owns proving, note
 * management, and the viewing key — this app never sees any of them.
 *
 * ## The placeholder rule
 *
 * Some fields are **literal strings the wallet substitutes during assembly**:
 *
 * - `"OPEN"` as an `amount` — "the amount is decided at execution time"
 * - `"${poolAddress}"` — the privacy pool's own address
 * - `"${openNoteIds[0]}"` — the id of the Nth open note created in this batch
 *
 * They must be passed through verbatim. Running them through `num.toHex` (as
 * you correctly do for every real address and amount) turns them into garbage
 * calldata and the transaction fails somewhere far from the cause. Only real
 * token addresses, amounts, and recipients get hex-normalised.
 */
import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";

import type { NetworkConfig } from "./networks";

export type Strk20Action = WALLET_API.STRK20_ACTION;

/** Literal placeholders the wallet substitutes. Never hex-normalise these. */
export const PLACEHOLDER = {
  /** Amount decided at execution time (fills an open note). */
  OPEN_AMOUNT: "OPEN",
  /** The privacy pool's address. */
  POOL_ADDRESS: "${poolAddress}",
  /** Id of the Nth open note created earlier in the same action list. */
  openNoteId: (index: number) => `\${openNoteIds[${index}]}`,
} as const;

/** Move funds from the public account into the privacy pool. */
export function shieldAction(
  network: NetworkConfig,
  amount: bigint,
): Strk20Action {
  return {
    type: "deposit",
    token: num.toHex(network.tokenAddress),
    amount: num.toHex(amount),
  };
}

/** Move funds out of the pool to a public address. */
export function unshieldAction(
  network: NetworkConfig,
  amount: bigint,
  recipient: string,
): Strk20Action {
  return {
    type: "withdraw",
    token: num.toHex(network.tokenAddress),
    amount: num.toHex(amount),
    recipient: num.toHex(recipient),
  };
}

/**
 * Move funds inside the pool. This is the payment primitive Vellum settles
 * invoices with: neither the amount nor the counterparties are public.
 */
export function privateTransferAction(
  network: NetworkConfig,
  amount: bigint,
  recipient: string,
): Strk20Action {
  return {
    type: "transfer",
    token: num.toHex(network.tokenAddress),
    amount: num.toHex(amount),
    recipient: num.toHex(recipient),
  };
}

/**
 * Call an anonymizer contract from inside the private transaction.
 *
 * `calldata` is passed through untouched — callers are responsible for
 * hex-normalising real values and leaving placeholders literal.
 */
export function invokeAction(
  contract: string,
  calldata: string[],
): Strk20Action {
  return { type: "invoke", contract: num.toHex(contract), calldata };
}

export interface PayInvoiceParams {
  network: NetworkConfig;
  /** Settlement amount in the token's smallest unit. */
  amount: bigint;
  /** The supplier's Starknet address. */
  supplierAddress: string;
  /** 128-bit invoice id, as a single felt. */
  invoiceId: string;
  /**
   * Hash binding this settlement to the invoice contents. Recomputable by
   * anyone holding the plaintext invoice, meaningless to anyone who is not.
   */
  paymentCommitment: string;
  /**
   * Registry address, when one is deployed on this network. Omit to settle
   * without an on-chain record — the payment still happens privately, but
   * there is nothing to prove against later.
   */
  registryAddress?: string;
}

/**
 * Settle an invoice: one private transfer, plus an atomic registry write.
 *
 * Both actions land in a single STRK20 transaction, so the invoice cannot be
 * marked paid without the money moving, and the money cannot move without the
 * invoice being marked. There is no window where the two disagree.
 *
 * The registry's `privacy_invoke` returns an empty `Span<OpenNoteDeposit>` —
 * it is a pure side effect, not a token round-trip, so no open note is created
 * and no `${openNoteIds[n]}` placeholder is needed.
 */
export function payInvoiceActions({
  network,
  amount,
  supplierAddress,
  invoiceId,
  paymentCommitment,
  registryAddress,
}: PayInvoiceParams): Strk20Action[] {
  const actions: Strk20Action[] = [
    privateTransferAction(network, amount, supplierAddress),
  ];

  if (registryAddress) {
    actions.push(
      invokeAction(registryAddress, [
        num.toHex(invoiceId),
        num.toHex(paymentCommitment),
        // Literal — the pool substitutes its own address and the contract
        // asserts it equals the caller, which is what makes a direct call
        // from outside the pool impossible.
        PLACEHOLDER.POOL_ADDRESS,
      ]),
    );
  }

  return actions;
}
