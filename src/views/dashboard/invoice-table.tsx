"use client";

/**
 * The invoice list itself.
 *
 * Every row needs `entry` (id, key, role, network) even when decryption
 * failed or has not finished — it is the one thing the vault guarantees, so
 * "copy link" and "forget" work regardless of what happened to the fetch.
 * Everything else about a row is optional and rendered defensively: one
 * ciphertext that will not decrypt must read as one broken row, not a blank
 * page.
 */
import { useState } from "react";

import { StatusPill } from "@/components/invoice/status-pill";
import { PressableButton, PressableLink } from "@/components/ui/pressable";
import { buildInvoiceLink } from "@/lib/invoice/crypto";
import { daysUntilDue, invoiceStatus } from "@/lib/invoice/status";
import type { Invoice, InvoiceParty, InvoiceStatus } from "@/lib/invoice/types";
import { MUTED_LINK, TEXT_LINK } from "@/lib/springs/interaction";
import { formatAmountPretty, shortHex } from "@/lib/starknet/format";
import { NETWORKS } from "@/lib/starknet/networks";

import type { DashboardRow } from "./use-dashboard";

const HEAD_CLASS =
  "px-card-x py-hud-inline text-left font-hud-mono text-hud-2xs tracking-hud text-chalk/50 uppercase";
const CELL_CLASS = "px-card-x py-card-y align-top";

export const InvoiceTable = ({
  rows,
  onForget,
  now,
}: {
  rows: DashboardRow[];
  onForget: (id: string) => void;
  now: number;
}) => (
  <div className="overflow-x-auto rounded-card border border-white/10 bg-surface shadow-glass">
    <table className="w-full min-w-[52rem] border-collapse">
      <caption className="sr-only">Your invoices, newest first</caption>
      <thead>
        <tr className="border-b border-white/10">
          <th scope="col" className={HEAD_CLASS}>
            Reference
          </th>
          <th scope="col" className={HEAD_CLASS}>
            Counterparty
          </th>
          <th scope="col" className={HEAD_CLASS}>
            Amount
          </th>
          <th scope="col" className={HEAD_CLASS}>
            Due
          </th>
          <th scope="col" className={HEAD_CLASS}>
            Status
          </th>
          <th scope="col" className={`${HEAD_CLASS} text-right`}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <InvoiceRow key={row.entry.id} row={row} onForget={onForget} now={now} />
        ))}
      </tbody>
    </table>
  </div>
);

const InvoiceRow = ({
  row,
  onForget,
  now,
}: {
  row: DashboardRow;
  onForget: (id: string) => void;
  now: number;
}) => {
  const { entry } = row;

  return (
    <tr className="border-b border-white/10 last:border-b-0">
      <td className={CELL_CLASS}>
        {row.status === "ready" ? (
          <p className="font-general text-body-sm text-chalk">
            {row.invoice.reference || shortHex(entry.id)}
          </p>
        ) : (
          <p className="font-hud-mono text-hud-sm text-chalk/60">
            {shortHex(entry.id)}
          </p>
        )}
        <p className="pt-hud-tight font-hud-mono text-hud-2xs tracking-hud text-chalk/40 uppercase">
          {NETWORKS[entry.network].label} · {entry.role === "issuer" ? "Issued" : "Received"}
        </p>
      </td>

      {row.status === "ready" ? (
        <ReadyCells row={row} now={now} />
      ) : row.status === "loading" ? (
        <td colSpan={4} className={CELL_CLASS}>
          <p className="font-hud-mono text-hud-xs tracking-hud text-chalk/50 uppercase">
            Decrypting locally…
          </p>
        </td>
      ) : (
        <td colSpan={4} className={CELL_CLASS}>
          <p className="font-general text-body-sm text-danger">{row.message}</p>
        </td>
      )}

      <td className={`${CELL_CLASS} text-right`}>
        <RowActions
          id={entry.id}
          href={buildInvoiceLink(
            typeof window !== "undefined" ? window.location.origin : "",
            entry.id,
            entry.key,
          )}
          onForget={onForget}
        />
      </td>
    </tr>
  );
};

const ReadyCells = ({
  row,
  now,
}: {
  row: Extract<DashboardRow, { status: "ready" }>;
  now: number;
}) => {
  const { invoice, stored, entry } = row;
  const isPaid = Boolean(stored.settlementTxHash);
  const status = invoiceStatus({ dueAt: invoice.dueAt, isPaid, now });
  const counterparty: InvoiceParty =
    entry.role === "issuer" ? invoice.buyer : invoice.supplier;
  const counterpartyLabel = entry.role === "issuer" ? "Buyer" : "Supplier";

  return (
    <>
      <td className={CELL_CLASS}>
        <p className="font-general text-body-sm text-chalk">{counterparty.name}</p>
        <p className="pt-hud-tight font-hud-mono text-hud-2xs tracking-hud text-chalk/40 uppercase">
          {counterpartyLabel} · {shortHex(counterparty.address)}
        </p>
      </td>
      <td className={CELL_CLASS}>
        <p className="font-hud-mono text-hud-sm text-chalk">
          {formatAmountPretty(BigInt(invoice.amountRaw), invoice.tokenDecimals)}{" "}
          {invoice.tokenSymbol}
        </p>
      </td>
      <td className={CELL_CLASS}>
        <DueCell invoice={invoice} paidAt={stored.paidAt} status={status} now={now} />
      </td>
      <td className={CELL_CLASS}>
        <StatusPill status={status} />
      </td>
    </>
  );
};

const DueCell = ({
  invoice,
  paidAt,
  status,
  now,
}: {
  invoice: Invoice;
  paidAt: string | null;
  status: InvoiceStatus;
  now: number;
}) => {
  const dueLabel = new Date(invoice.dueAt * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const days = daysUntilDue(invoice.dueAt, now);
  const caption =
    status === "paid"
      ? paidAt
        ? `Paid ${new Date(paidAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`
        : "Paid"
      : status === "overdue"
        ? `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`
        : days === 0
          ? "Due today"
          : `Due in ${days} ${days === 1 ? "day" : "days"}`;

  return (
    <>
      <p className="font-general text-body-sm text-chalk">{dueLabel}</p>
      <p className="pt-hud-tight font-hud-mono text-hud-2xs tracking-hud text-chalk/40 uppercase">
        {caption}
      </p>
    </>
  );
};

const RowActions = ({
  id,
  href,
  onForget,
}: {
  id: string;
  href: string;
  onForget: (id: string) => void;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied or unavailable — the link is still right
      // there in the row, so this is a convenience, not the only way to get it.
    }
  };

  const handleForget = () => {
    const confirmed = window.confirm(
      "Forget this invoice on this device? Its decryption key will be removed " +
        "from this browser. You will only be able to reopen it from its " +
        "original link.",
    );
    if (confirmed) onForget(id);
  };

  return (
    <div className="flex items-center justify-end gap-hud-gap">
      <PressableLink
        href={href}
        interaction={MUTED_LINK}
        className="font-hud-mono text-hud-xs tracking-hud uppercase"
      >
        View
      </PressableLink>
      <PressableButton
        type="button"
        onClick={handleCopy}
        interaction={MUTED_LINK}
        className="font-hud-mono text-hud-xs tracking-hud uppercase"
      >
        {copied ? "Copied" : "Copy link"}
      </PressableButton>
      <PressableButton
        type="button"
        onClick={handleForget}
        interaction={TEXT_LINK}
        className="font-hud-mono text-hud-xs tracking-hud text-danger uppercase"
      >
        Forget
      </PressableButton>
    </div>
  );
};
