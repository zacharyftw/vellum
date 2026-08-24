/**
 * Submitting STRK20 action batches and waiting for them to settle.
 *
 * Privacy-pool transactions verify a STARK proof on-chain, so they take far
 * longer than an ordinary invoke. The retry budget below is deliberately
 * generous — a timeout here means "we stopped watching", never "it failed",
 * and the caller is told which of the two happened.
 */
import type { Call, WalletAccountV6 } from "starknet";
import { num } from "starknet";

import { formatAmount, prettyStatus } from "./format";
import { providerFor, type NetworkConfig } from "./networks";
import type { Strk20Action } from "./strk20";

/** ~20 minutes at 3s intervals. Proof verification is slow, not broken. */
const RECEIPT_RETRIES = 400;
const RECEIPT_INTERVAL_MS = 3000;

export type SettlementPhase =
  | "signing"
  | "pending"
  | "confirmed"
  | "reverted"
  | "unconfirmed"
  | "failed";

export interface Settlement {
  phase: SettlementPhase;
  txHash?: string;
  /** Human-readable status: "Accepted on L2 · Succeeded". */
  status?: string;
  /** Network fee, formatted in the network's token. */
  fee?: string;
  /** Error message when `phase` is "failed" or "unconfirmed". */
  message?: string;
}

/** Shape we read off a receipt. The RPC response is wider than this. */
interface ReceiptLike {
  execution_status?: string;
  finality_status?: string;
  actual_fee?: { amount?: string } | string;
  events?: unknown[];
}

function unwrapReceipt(raw: unknown): ReceiptLike {
  if (raw && typeof raw === "object" && "value" in raw) {
    return (raw as { value: ReceiptLike }).value;
  }
  return (raw ?? {}) as ReceiptLike;
}

function readFee(receipt: ReceiptLike, network: NetworkConfig): string | undefined {
  const raw =
    typeof receipt.actual_fee === "object"
      ? receipt.actual_fee?.amount
      : receipt.actual_fee;
  if (raw === undefined || raw === null) return undefined;
  try {
    return `${formatAmount(num.toBigInt(raw), network.tokenDecimals)} ${network.tokenSymbol}`;
  } catch {
    return undefined;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Wait for a submitted transaction and report its outcome. Shared by every
 * submit path below — a batched STRK20 action and a plain invoke differ only
 * in how the transaction gets sent, never in how it's watched afterward.
 */
async function watchReceipt(
  network: NetworkConfig,
  txHash: string,
  report: (settlement: Settlement) => Settlement,
): Promise<Settlement> {
  try {
    const receipt = unwrapReceipt(
      await providerFor(network.key).waitForTransaction(txHash, {
        retries: RECEIPT_RETRIES,
        retryInterval: RECEIPT_INTERVAL_MS,
      }),
    );

    const status = prettyStatus(
      receipt.finality_status,
      receipt.execution_status,
    );
    const fee = readFee(receipt, network);

    if (receipt.execution_status === "REVERTED") {
      return report({ phase: "reverted", txHash, status, fee });
    }
    return report({ phase: "confirmed", txHash, status, fee });
  } catch (error) {
    // The transaction was accepted by the node — we simply stopped waiting.
    // Reporting this as a failure would be a lie, and would invite the user to
    // pay a second time.
    return report({
      phase: "unconfirmed",
      txHash,
      message: toMessage(error),
    });
  }
}

/**
 * Submit a batch and watch it to completion, reporting each phase.
 *
 * `onPhase` fires on every transition so the UI can show the tx hash while the
 * proof is still being verified, rather than a spinner with nothing behind it.
 */
export async function submitStrk20(
  walletAccount: WalletAccountV6,
  network: NetworkConfig,
  actions: Strk20Action[],
  onPhase?: (settlement: Settlement) => void,
): Promise<Settlement> {
  const report = (settlement: Settlement): Settlement => {
    onPhase?.(settlement);
    return settlement;
  };

  report({ phase: "signing" });

  let txHash: string;
  try {
    const submitted = await walletAccount.strk20InvokeTransaction(actions);
    txHash = submitted.transaction_hash;
  } catch (error) {
    return report({ phase: "failed", message: toMessage(error) });
  }

  report({ phase: "pending", txHash });
  return watchReceipt(network, txHash, report);
}

/**
 * Submit an ordinary contract call — not a privacy-pool action — and watch it
 * to completion. Used for `anchor_invoice`: an ordinary public invoke that
 * never goes through `strk20InvokeTransaction`.
 */
export async function submitInvoke(
  walletAccount: WalletAccountV6,
  network: NetworkConfig,
  calls: Call | Call[],
  onPhase?: (settlement: Settlement) => void,
): Promise<Settlement> {
  const report = (settlement: Settlement): Settlement => {
    onPhase?.(settlement);
    return settlement;
  };

  report({ phase: "signing" });

  let txHash: string;
  try {
    const submitted = await walletAccount.execute(calls);
    txHash = submitted.transaction_hash;
  } catch (error) {
    return report({ phase: "failed", message: toMessage(error) });
  }

  report({ phase: "pending", txHash });
  return watchReceipt(network, txHash, report);
}
