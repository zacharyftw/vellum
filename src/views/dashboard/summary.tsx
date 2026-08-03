/**
 * The top-line numbers.
 *
 * Grouped by token symbol rather than assumed to be one currency — every
 * network in `lib/starknet/networks.ts` settles in STRK today, but the
 * `Invoice` a browser decrypts carries its own `tokenSymbol`, so an invoice
 * from a future or foreign deployment should not get silently added into a
 * total denominated in something else. Everything here is `bigint`; a `Number`
 * would start losing precision on an 18-decimal token before the value even
 * gets interesting.
 */
import { invoiceStatus } from "@/lib/invoice/status";
import { formatAmountPretty } from "@/lib/starknet/format";

import type { ReadyRow } from "./use-dashboard";

interface TokenTotal {
  symbol: string;
  decimals: number;
  outstanding: bigint;
  overdue: bigint;
}

function summarize(rows: ReadyRow[], now: number) {
  const byToken = new Map<string, TokenTotal>();
  let paidCount = 0;

  for (const { invoice, stored } of rows) {
    const isPaid = Boolean(stored.settlementTxHash);
    const status = invoiceStatus({ dueAt: invoice.dueAt, isPaid, now });

    if (status === "paid") {
      paidCount += 1;
      continue;
    }

    const amount = BigInt(invoice.amountRaw);
    const totals = byToken.get(invoice.tokenSymbol) ?? {
      symbol: invoice.tokenSymbol,
      decimals: invoice.tokenDecimals,
      outstanding: 0n,
      overdue: 0n,
    };
    totals.outstanding += amount;
    if (status === "overdue") totals.overdue += amount;
    byToken.set(invoice.tokenSymbol, totals);
  }

  return { totals: [...byToken.values()], paidCount };
}

/** Joins non-zero totals per token: `"1,200 STRK"`, or `"1,200 STRK + 40 USDC"`. */
function formatTotals(totals: TokenTotal[], key: "outstanding" | "overdue"): string {
  const parts = totals
    .filter((total) => total[key] > 0n)
    .map((total) => `${formatAmountPretty(total[key], total.decimals)} ${total.symbol}`);
  return parts.length > 0 ? parts.join(" + ") : "0";
}

export const DashboardSummary = ({
  rows,
  now,
}: {
  rows: ReadyRow[];
  now: number;
}) => {
  const { totals, paidCount } = summarize(rows, now);

  const stats = [
    { label: "Outstanding", value: formatTotals(totals, "outstanding") },
    { label: "Overdue", value: formatTotals(totals, "overdue") },
    { label: "Paid", value: String(paidCount) },
  ];

  return (
    <div className="grid grid-cols-3 gap-hud-gap max-sm:grid-cols-1">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-card border border-white/10 bg-surface p-card-x py-card-y shadow-glass"
        >
          <p className="font-hud-mono text-hud-xs tracking-hud text-chalk/60 uppercase">
            {stat.label}
          </p>
          <p className="pt-hud-tight font-general text-stat leading-title tracking-title">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
};
