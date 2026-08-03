/**
 * The invoice itself, rendered the way a finance team expects to read one:
 * parties, reference, a line-item table with amounts right-aligned, a total
 * that is impossible to miss, and the dates that decide whether it is overdue.
 */
import { StatusPill } from "@/components/invoice/status-pill";
import type { Invoice, InvoiceParty, InvoiceStatus } from "@/lib/invoice/types";
import { formatAmountPretty, shortHex } from "@/lib/starknet/format";
import { NETWORKS } from "@/lib/starknet/networks";

import { CommitmentBadge } from "./commitment-badge";

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PartyBlock = ({ label, party }: { label: string; party: InvoiceParty }) => (
  <div>
    <p className="font-hud-mono text-hud-2xs tracking-hud uppercase text-chalk/50">
      {label}
    </p>
    <p className="pt-hud-tight font-general text-body-sm">{party.name}</p>
    <p className="pt-hud-tight font-hud-mono text-hud-xs text-chalk/50">
      {shortHex(party.address)}
    </p>
    {party.taxId ? (
      <p className="pt-hud-tight font-hud-mono text-hud-xs text-chalk/50">
        Tax ID {party.taxId}
      </p>
    ) : null}
  </div>
);

export const InvoiceDocument = ({
  invoice,
  status,
  commitmentValid,
}: {
  invoice: Invoice;
  status: InvoiceStatus;
  commitmentValid: boolean;
}) => {
  const network = NETWORKS[invoice.network];
  const total = BigInt(invoice.amountRaw);
  const overdue = status === "overdue";

  return (
    <article className="overflow-hidden rounded-card border border-white/10 bg-surface shadow-glass">
      <header className="flex flex-wrap items-start justify-between gap-hud-gap border-b border-white/10 p-card-x py-card-y">
        <div>
          <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
            {network.label} · Ref {invoice.reference}
          </p>
          <h1 className="pt-hud-tight font-general text-faq-question leading-title tracking-title">
            {invoice.supplier.name}
            <span aria-hidden className="px-hud-tight text-chalk/40">
              →
            </span>
            {invoice.buyer.name}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-hud-tight">
          <StatusPill status={status} />
          <CommitmentBadge valid={commitmentValid} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-hud-gap p-card-x py-card-y max-sm:grid-cols-1">
        <PartyBlock label="From" party={invoice.supplier} />
        <PartyBlock label="Bill to" party={invoice.buyer} />
      </div>

      <div className="grid grid-cols-2 gap-hud-gap px-card-x pb-card-y font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50 max-sm:grid-cols-1">
        <p>Issued {formatDate(invoice.issuedAt)}</p>
        <p className={overdue ? "text-danger" : undefined}>
          Due {formatDate(invoice.dueAt)}
        </p>
      </div>

      <table className="w-full border-t border-white/10 font-general text-body-sm">
        <thead>
          <tr className="text-left font-hud-mono text-hud-2xs tracking-hud text-chalk/50 uppercase">
            <th scope="col" className="px-card-x py-hud-tight font-normal">
              Description
            </th>
            <th scope="col" className="py-hud-tight text-right font-normal">
              Qty
            </th>
            <th scope="col" className="px-card-x py-hud-tight text-right font-normal">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, index) => (
            <tr key={index} className="border-t border-white/5">
              <td className="px-card-x py-hud-inline">{item.description}</td>
              <td className="py-hud-inline text-right text-chalk/70">
                {item.quantity}
              </td>
              <td className="px-card-x py-hud-inline text-right whitespace-nowrap">
                {formatAmountPretty(BigInt(item.amountRaw), invoice.tokenDecimals)}{" "}
                {invoice.tokenSymbol}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/10">
            <td
              colSpan={2}
              className="px-card-x py-card-y font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50"
            >
              Total
            </td>
            <td className="px-card-x py-card-y text-right font-general text-card-value whitespace-nowrap">
              {formatAmountPretty(total, invoice.tokenDecimals)} {invoice.tokenSymbol}
            </td>
          </tr>
        </tfoot>
      </table>

      {invoice.notes ? (
        <div className="border-t border-white/10 p-card-x py-card-y">
          <p className="font-hud-mono text-hud-2xs tracking-hud uppercase text-chalk/50">
            Notes
          </p>
          <p className="pt-hud-tight font-general text-body-sm leading-body text-chalk/70">
            {invoice.notes}
          </p>
        </div>
      ) : null}
    </article>
  );
};
