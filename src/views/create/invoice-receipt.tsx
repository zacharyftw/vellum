/**
 * The success state — the one moment the issuer holds the invoice link.
 *
 * We never see this link ourselves (the key lives only in its fragment), so
 * this screen is the issuer's only copy. It reads like a receipt on purpose:
 * the numbers that matter are legible at a glance, and the warning about the
 * link is not buried under them.
 */
import { useState } from "react";

import { PressableButton, PressableLink } from "@/components/ui/pressable";
import { GHOST, SOLID_CTA, TEXT_LINK } from "@/lib/springs/interaction";
import { formatAmountPretty } from "@/lib/starknet/format";

import type { Invoice } from "@/lib/invoice/types";

export interface IssuedInvoice {
  invoice: Invoice;
  link: string;
}

export interface InvoiceReceiptProps {
  issued: IssuedInvoice;
  onCreateAnother: () => void;
}

export const InvoiceReceipt = ({ issued, onCreateAnother }: InvoiceReceiptProps) => {
  const { invoice, link } = issued;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied outright — the link is still selectable
      // text in the field below, so the issuer is never actually stuck.
    }
  };

  const amount = formatAmountPretty(BigInt(invoice.amountRaw), invoice.tokenDecimals);
  const due = new Date(invoice.dueAt * 1000).toLocaleDateString();

  return (
    <div className="mx-auto max-w-content-copy">
      <p className="flex items-center gap-hud-inline font-hud-mono text-hud-xs tracking-hud uppercase text-signal">
        <span aria-hidden className="size-dot rounded-full bg-signal shadow-signal" />
        Invoice issued
      </p>
      <h1 className="pt-hud-gap font-general text-outro-title leading-title tracking-title text-shadow-title">
        Send this to {invoice.buyer.name}.
      </h1>

      <div className="mt-section-sm rounded-card border border-white/10 bg-surface-raised p-card-x shadow-glass">
        <dl className="grid grid-cols-2 gap-card max-sm:grid-cols-1">
          <div>
            <dt className="font-hud-mono text-hud-2xs tracking-hud uppercase text-chalk/50">
              Invoice
            </dt>
            <dd className="pt-hud-tight font-hud-mono text-hud-sm break-all text-chalk/80">
              {invoice.id}
            </dd>
          </div>
          <div>
            <dt className="font-hud-mono text-hud-2xs tracking-hud uppercase text-chalk/50">
              Amount
            </dt>
            <dd className="pt-hud-tight text-card-value text-chalk">
              {amount} {invoice.tokenSymbol}
            </dd>
          </div>
          <div>
            <dt className="font-hud-mono text-hud-2xs tracking-hud uppercase text-chalk/50">
              Customer
            </dt>
            <dd className="pt-hud-tight font-general text-body-sm text-chalk">
              {invoice.buyer.name}
            </dd>
          </div>
          <div>
            <dt className="font-hud-mono text-hud-2xs tracking-hud uppercase text-chalk/50">
              Due
            </dt>
            <dd className="pt-hud-tight font-general text-body-sm text-chalk">{due}</dd>
          </div>
        </dl>

        <div className="pt-card">
          <label
            htmlFor="invoice-link"
            className="block font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/60"
          >
            Payment link
          </label>
          <div className="mt-hud-tight flex items-center gap-hud-inline">
            <input
              id="invoice-link"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full rounded-card border border-white/10 bg-void/40 px-card-x py-card-y font-hud-mono text-hud-sm text-chalk/80 outline-none focus-visible:border-signal/60 focus-visible:ring-2 focus-visible:ring-signal/30"
            />
            <PressableButton
              type="button"
              interaction={SOLID_CTA}
              onClick={handleCopy}
              className="shrink-0 rounded-card px-cta-x py-card-y font-hud-mono text-hud-xs tracking-hud uppercase shadow-glass"
            >
              {copied ? "Copied" : "Copy link"}
            </PressableButton>
          </div>
        </div>

        <p
          role="alert"
          className="mt-card rounded-card border border-danger/40 bg-danger/10 px-card-x py-card-y font-general text-body-sm leading-body text-danger"
        >
          Anyone who has this link can open and read this invoice — it is the
          invoice. Send it only to {invoice.buyer.name}, over a channel you
          trust.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-hud-gap pt-section-sm">
        <PressableButton
          type="button"
          interaction={GHOST}
          onClick={onCreateAnother}
          className="inline-flex items-center gap-hud-inline rounded-card border px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase backdrop-blur-glass"
        >
          Issue another invoice
        </PressableButton>
        <PressableLink
          href="/dashboard"
          interaction={TEXT_LINK}
          className="font-hud-mono text-hud-sm tracking-hud uppercase underline underline-offset-4"
        >
          View dashboard
        </PressableLink>
      </div>
    </div>
  );
};
