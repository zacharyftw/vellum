/**
 * Display + parsing helpers for on-chain values.
 *
 * Amounts are handled as `bigint` in the token's smallest unit everywhere
 * except the edges of the UI. Floating point never touches a monetary value —
 * `parseAmount` walks the decimal string by hand so 0.1 + 0.2 problems cannot
 * reach a settlement.
 */
import { num } from "starknet";

/** Format a smallest-unit amount as a human string: `1500000000000000000` → `"1.5"`. */
export function formatAmount(amount: bigint, decimals: number): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return negative ? `-${body}` : body;
}

/**
 * Format with thousands separators and at most `maxFrac` decimals, for display
 * in tables and receipts: `"12,500.25"`.
 */
export function formatAmountPretty(
  amount: bigint,
  decimals: number,
  maxFrac = 2,
): string {
  const raw = formatAmount(amount, decimals);
  const [whole, frac = ""] = raw.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmed = frac.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

/**
 * Parse a user-entered decimal string into a smallest-unit `bigint`.
 *
 * Throws on anything that is not a plain non-negative decimal, and on more
 * fractional digits than the token supports — silently truncating a customer's
 * invoice amount is not an acceptable failure mode.
 */
export function parseAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`"${input}" is not a valid amount.`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`At most ${decimals} decimal places are supported.`);
  }
  return BigInt(whole + frac.padEnd(decimals, "0"));
}

/** Shorten a hex value for display: `"0x1dc5a1c…1927a"`. */
export function shortHex(value: string, lead = 6, tail = 4): string {
  let hex: string;
  try {
    hex = num.toHex(value);
  } catch {
    hex = value;
  }
  return hex.length <= lead + tail + 1 ? hex : `${hex.slice(0, lead)}…${hex.slice(-tail)}`;
}

/** Human-readable transaction status: `"Accepted on L2 · Succeeded"`. */
export function prettyStatus(finality?: string, execution?: string): string {
  const f =
    finality === "ACCEPTED_ON_L2"
      ? "Accepted on L2"
      : finality === "ACCEPTED_ON_L1"
        ? "Accepted on L1"
        : finality === "RECEIVED"
          ? "Received"
          : (finality ?? "");
  const e =
    execution === "SUCCEEDED"
      ? "Succeeded"
      : execution === "REVERTED"
        ? "Reverted"
        : "";
  return [f, e].filter(Boolean).join(" · ") || "Confirmed";
}
