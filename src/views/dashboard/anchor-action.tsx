"use client";

/**
 * "Anchor" — fixes an invoice's commitment on-chain ahead of payment.
 *
 * Optional, and only useful to the issuer: `anchor_invoice`
 * (`cairo/src/lib.cairo`) proves the terms existed before settlement, at the
 * cost of a public transaction linking the issuer's wallet to this invoice
 * id. Settling an invoice that was never anchored anchors it anyway — this is
 * purely about getting that proof *before* payment rather than at it.
 *
 * Renders nothing once the invoice is paid (settlement always anchors it, so
 * the action would be redundant) or when the invoice's network has no
 * deployed registry to anchor against.
 */
import { useState } from "react";

import { PressableButton } from "@/components/ui/pressable";
import { invoiceCommitment } from "@/lib/invoice/commitment";
import type { Invoice } from "@/lib/invoice/types";
import { MUTED_LINK } from "@/lib/springs/interaction";
import { describeStrk20Error } from "@/lib/starknet/errors";
import { hasRegistry, NETWORKS, type NetworkKey } from "@/lib/starknet/networks";
import { anchorInvoiceCall } from "@/lib/starknet/registry";
import { submitInvoke, type Settlement } from "@/lib/starknet/submit";
import { useWalletStore } from "@/lib/starknet/wallet-store";

export interface AnchorActionProps {
  invoice: Invoice;
  network: NetworkKey;
  isPaid: boolean;
}

export const AnchorAction = ({ invoice, network: networkKey, isPaid }: AnchorActionProps) => {
  const walletAccount = useWalletStore((state) => state.walletAccount);
  const isConnected = useWalletStore((state) => state.isConnected);
  const walletNetwork = useWalletStore((state) => state.network);

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<string | undefined>();

  const network = NETWORKS[networkKey];

  if (isPaid || !hasRegistry(network)) return null;
  if (settlement?.phase === "confirmed") {
    return (
      <p className="font-hud-mono text-hud-2xs tracking-hud text-signal uppercase">Anchored</p>
    );
  }

  const handleAnchor = async () => {
    setPrompt(undefined);

    if (!isConnected || !walletAccount) {
      setPrompt("Connect your wallet to anchor this invoice.");
      return;
    }
    if (walletNetwork?.key !== networkKey) {
      setPrompt(`Switch your wallet to ${network.label} to anchor this invoice.`);
      return;
    }

    setBusy(true);
    try {
      const commitment = await invoiceCommitment(invoice);
      const call = anchorInvoiceCall(network, invoice.id, commitment);
      await submitInvoke(walletAccount, network, call, setSettlement);
    } catch (error) {
      const described = describeStrk20Error(error);
      setSettlement({
        phase: "failed",
        message: [described.message, described.action].filter(Boolean).join(" "),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-hud-tight">
      <PressableButton
        type="button"
        onClick={handleAnchor}
        disabled={busy}
        interaction={MUTED_LINK}
        className="font-hud-mono text-hud-xs tracking-hud uppercase disabled:opacity-50"
      >
        {settlement?.phase === "pending" ? "Anchoring…" : "Anchor"}
      </PressableButton>
      {prompt ? (
        <p className="font-hud-mono text-hud-2xs tracking-hud text-caution">{prompt}</p>
      ) : null}
      {settlement ? <AnchorStatus settlement={settlement} /> : null}
    </div>
  );
};

const AnchorStatus = ({ settlement }: { settlement: Settlement }) => {
  switch (settlement.phase) {
    case "signing":
      return (
        <p className="font-hud-mono text-hud-2xs tracking-hud text-chalk/50">
          Confirm in your wallet…
        </p>
      );
    case "pending":
      return (
        <p className="font-hud-mono text-hud-2xs tracking-hud text-chalk/50">
          Waiting for confirmation…
        </p>
      );
    case "reverted":
      return (
        <p className="font-hud-mono text-hud-2xs tracking-hud text-danger">
          Reverted — try again.
        </p>
      );
    case "unconfirmed":
      return (
        <p className="font-hud-mono text-hud-2xs tracking-hud text-caution">
          Submitted — check the explorer.
        </p>
      );
    case "failed":
      return (
        <p role="alert" className="font-hud-mono text-hud-2xs tracking-hud text-danger">
          {settlement.message ?? "Failed."}
        </p>
      );
    default:
      return null;
  }
};
