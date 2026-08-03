/**
 * The paid state. Once `settlementTxHash` is set there is nothing left to
 * decide — no button, no risk of a second payment — just the record of what
 * happened and where to verify it.
 */
import type { StoredInvoice } from "@/lib/invoice/schemas";
import { shortHex } from "@/lib/starknet/format";
import { explorerTxUrl, type NetworkConfig } from "@/lib/starknet/networks";

export const ReceiptPanel = ({
  stored,
  network,
}: {
  stored: StoredInvoice;
  network: NetworkConfig;
}) => (
  <div className="flex flex-col gap-hud-gap rounded-card border border-signal/30 bg-surface-raised p-card-x py-card-y shadow-glass">
    <div>
      <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-signal">Paid</p>
      <p className="pt-hud-tight font-general text-body-sm leading-body text-chalk/70">
        {stored.paidAt
          ? `Settled ${new Date(stored.paidAt).toLocaleString()}.`
          : "This invoice has been settled."}
      </p>
    </div>

    {stored.settlementTxHash ? (
      <a
        href={explorerTxUrl(network, stored.settlementTxHash)}
        target="_blank"
        rel="noreferrer"
        className="font-hud-mono text-hud-xs tracking-hud text-chalk/70 underline underline-offset-2"
      >
        {shortHex(stored.settlementTxHash)} — view on explorer ↗
      </a>
    ) : null}
  </div>
);
