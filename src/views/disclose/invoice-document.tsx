import { RevealHeading, RevealUnit } from "@/components/motion/reveal";
import { StatusPill } from "@/components/invoice/status-pill";
import type { Invoice, InvoiceParty, InvoiceStatus } from "@/lib/invoice/types";
import { formatAmountPretty } from "@/lib/starknet/format";

import { formatDate } from "./format-date";

/** Enough fractional digits that a token amount doesn't visibly round away. */
const MAX_FRAC = 6;

const Party = ({ role, party }: { role: string; party: InvoiceParty }) => (
  <div className="rounded-card border border-white/10 bg-surface p-card-x py-card-y">
    <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
      {role}
    </p>
    <p className="pt-hud-tight font-general text-card-value leading-title">
      {party.name}
    </p>
    {party.taxId ? (
      <p className="pt-hud-tight font-hud-mono text-hud-xs text-chalk/50">
        Tax ID {party.taxId}
      </p>
    ) : null}
    <p className="pt-card font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
      Starknet address
    </p>
    <p className="break-all pt-hud-tight font-hud-mono text-hud-xs leading-body text-chalk/80">
      {party.address}
    </p>
  </div>
);

export interface InvoiceDocumentProps {
  invoice: Invoice;
  status: InvoiceStatus;
}

/**
 * The invoice itself, laid out as a formal document — this is the thing an
 * accountant actually needs a copy of, independent of whatever the
 * verification banner above it says.
 */
export const InvoiceDocument = ({ invoice, status }: InvoiceDocumentProps) => (
  <RevealUnit
    tag="article"
    aria-label="Invoice document"
    className="rounded-card border border-white/10 bg-surface-raised p-section-sm shadow-glass"
  >
    <div className="flex flex-wrap items-start justify-between gap-hud-gap">
      <div>
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Reference
        </p>
        <RevealHeading
          tag="h2"
          className="pt-hud-tight font-general text-faq-question leading-title tracking-title"
        >
          {invoice.reference}
        </RevealHeading>
      </div>
      <StatusPill status={status} />
    </div>

    <dl className="grid grid-cols-2 gap-hud-gap pt-card max-sm:grid-cols-1">
      <div>
        <dt className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Issued
        </dt>
        <dd className="pt-hud-tight font-general text-body">
          {formatDate(invoice.issuedAt)}
        </dd>
      </div>
      <div>
        <dt className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Due
        </dt>
        <dd className="pt-hud-tight font-general text-body">
          {formatDate(invoice.dueAt)}
        </dd>
      </div>
    </dl>

    <div className="grid grid-cols-2 gap-hud-gap pt-section-sm max-sm:grid-cols-1">
      <Party role="Supplier" party={invoice.supplier} />
      <Party role="Buyer" party={invoice.buyer} />
    </div>

    <div className="overflow-x-auto pt-section-sm">
      <table className="w-full min-w-[32rem] border-collapse text-left">
        <caption className="sr-only">Line items for {invoice.reference}</caption>
        <thead>
          <tr className="border-b border-white/10">
            <th
              scope="col"
              className="pb-card font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50"
            >
              Description
            </th>
            <th
              scope="col"
              className="pb-card font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50"
            >
              Quantity
            </th>
            <th
              scope="col"
              className="pb-card text-right font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50"
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, index) => (
            <tr key={`${item.description}-${index}`} className="border-b border-white/5">
              <td className="py-card font-general text-body-sm leading-body">
                {item.description}
              </td>
              <td className="py-card font-general text-body-sm leading-body text-chalk/70">
                {item.quantity}
              </td>
              <td className="py-card text-right font-hud-mono text-hud-sm">
                {formatAmountPretty(BigInt(item.amountRaw), invoice.tokenDecimals, MAX_FRAC)}{" "}
                {invoice.tokenSymbol}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="pt-card text-right font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
              Total
            </td>
            <td className="pt-card text-right font-hud-mono text-card-value">
              {formatAmountPretty(BigInt(invoice.amountRaw), invoice.tokenDecimals, MAX_FRAC)}{" "}
              {invoice.tokenSymbol}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    {invoice.notes ? (
      <div className="pt-section-sm">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Notes
        </p>
        <p className="max-w-content-copy pt-hud-tight font-general text-body-sm leading-body whitespace-pre-wrap text-chalk/70">
          {invoice.notes}
        </p>
      </div>
    ) : null}
  </RevealUnit>
);
