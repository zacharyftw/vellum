"use client";

/**
 * The "Pay privately" flow.
 *
 * Once a transaction has a hash, the pay button disappears rather than just
 * disabling — a privacy-pool transfer takes minutes to confirm, and a button
 * that is merely greyed out invites a second click "just in case". The only
 * phases that bring the button back are `failed` (nothing was ever submitted)
 * and `reverted` (submitted, but nothing moved). `unconfirmed` never does —
 * that phase means we stopped watching, not that the payment failed, and
 * offering a retry there is how a buyer ends up paying twice.
 */
import { useEffect, useState } from "react";

import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { PressableButton } from "@/components/ui/pressable";
import { InvoiceApiError, updateInvoice } from "@/lib/invoice/api";
import { paymentCommitment } from "@/lib/invoice/commitment";
import type { StoredInvoice } from "@/lib/invoice/schemas";
import type { Invoice } from "@/lib/invoice/types";
import { rememberInvoice } from "@/lib/invoice/vault";
import { formatAmountPretty, shortHex } from "@/lib/starknet/format";
import {
  NETWORKS,
  explorerTxUrl,
  hasRegistry,
  isProviderConfigured,
  type NetworkConfig,
} from "@/lib/starknet/networks";
import { describeStrk20Error } from "@/lib/starknet/errors";
import { readRegistration, type RegistrationLookup } from "@/lib/starknet/pool";
import { payInvoiceActions } from "@/lib/starknet/strk20";
import { submitStrk20, type Settlement } from "@/lib/starknet/submit";
import { useWalletStore } from "@/lib/starknet/wallet-store";
import { GHOST, SOLID_CTA } from "@/lib/springs/interaction";

import { PulseDot } from "./fade-in";

const PAY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-hud-inline rounded-card px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase shadow-glass disabled:opacity-50";

export interface PaymentPanelProps {
  id: string;
  encodedKey: string;
  invoice: Invoice;
  commitmentValid: boolean;
  /** Fired once the server confirms the settlement was recorded. */
  onSettled: (stored: StoredInvoice) => void;
}

export const PaymentPanel = ({
  id,
  encodedKey,
  invoice,
  commitmentValid,
  onSettled,
}: PaymentPanelProps) => {
  const walletAccount = useWalletStore((state) => state.walletAccount);
  const address = useWalletStore((state) => state.address);
  const isConnected = useWalletStore((state) => state.isConnected);
  const walletNetwork = useWalletStore((state) => state.network);

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | undefined>();
  const [payeeRegistration, setPayeeRegistration] = useState<RegistrationLookup>({
    status: "unavailable",
    reason: "no-pool",
  });

  const invoiceNetwork = NETWORKS[invoice.network];

  // The pool refuses to open a channel to an address that never registered a
  // viewing key, and depositing does not register you — so a supplier can hold
  // a shielded balance and still be unpayable. Checking here means the buyer
  // reads a sentence instead of watching a transaction revert on a condition
  // only the supplier can fix.
  useEffect(() => {
    let cancelled = false;
    readRegistration(invoiceNetwork, invoice.supplier.address).then((result) => {
      if (!cancelled) setPayeeRegistration(result);
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceNetwork, invoice.supplier.address]);
  const networkMismatch = isConnected && walletNetwork?.key !== invoice.network;
  const canAttemptPayment =
    !settlement || settlement.phase === "failed" || settlement.phase === "reverted";

  if (!commitmentValid) {
    return (
      <div className="rounded-card border border-danger/40 bg-surface-raised p-card-x py-card-y">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-danger">
          Payment disabled
        </p>
        <p className="pt-hud-tight font-general text-body-sm leading-body text-chalk/70">
          This invoice does not match the fingerprint anchored on-chain. It may
          have been altered or corrupted since it was issued — ask the
          supplier to resend the link before paying.
        </p>
      </div>
    );
  }

  if (payeeRegistration.status === "unregistered") {
    return (
      <div className="rounded-card border border-caution/40 bg-surface-raised p-card-x py-card-y">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-caution">
          Supplier cannot receive yet
        </p>
        <p className="pt-hud-tight font-general text-body-sm leading-body text-chalk/70">
          {invoice.supplier.name} has not set up their account to receive
          private payments. Until they do, a payment to them would be rejected
          by the network — so there is nothing to pay against yet.
        </p>
        <p className="pt-card font-general text-body-sm leading-body text-chalk/50">
          Only they can do this, from their own wallet. It is a one-time setup,
          separate from holding a balance. Send them this invoice link again
          once it is done.
        </p>
      </div>
    );
  }

  const handlePay = async () => {
    if (!walletAccount || !address || networkMismatch) return;
    setSaveWarning(undefined);
    setBusy(true);
    try {
      const commitment = await paymentCommitment(invoice, address);
      const registryAddress = hasRegistry(invoiceNetwork)
        ? invoiceNetwork.registryAddress
        : undefined;
      const actions = payInvoiceActions({
        network: invoiceNetwork,
        amount: BigInt(invoice.amountRaw),
        supplierAddress: invoice.supplier.address,
        invoiceId: invoice.id,
        paymentCommitment: commitment,
        registryAddress,
      });

      const result = await submitStrk20(
        walletAccount,
        invoiceNetwork,
        actions,
        setSettlement,
      );

      // Remember it the moment a transaction exists, not only on confirmation.
      // `unconfirmed` means we stopped watching a transaction that was already
      // submitted — dropping it here would take a payment the buyer very
      // possibly made off their dashboard, leaving the original link as the
      // only way back to it.
      if (result.txHash) {
        rememberInvoice({ id, key: encodedKey, role: "payer", network: invoice.network });
      }

      if (result.phase === "confirmed" && result.txHash) {
        try {
          const updated = await updateInvoice(id, { settlementTxHash: result.txHash });
          onSettled(updated);
        } catch (error) {
          setSaveWarning(
            `Payment confirmed on-chain, but we could not save the receipt${
              error instanceof InvoiceApiError ? ` (${error.message})` : ""
            }. Keep this transaction hash — it is your proof of payment.`,
          );
        }
      }
    } catch (error) {
      const described = describeStrk20Error(error);
      setSettlement({
        phase: "failed",
        message: [described.message, described.action].filter(Boolean).join(" "),
      });
      // A revert is the authoritative answer about registration, and it
      // outranks whatever the pre-flight read concluded — including the case
      // where there was no pool address to ask.
      if (described.raw.includes("RECIPIENT_NOT_REGISTERED")) {
        setPayeeRegistration({ status: "unregistered" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-hud-gap rounded-card border border-white/10 bg-surface-raised p-card-x py-card-y shadow-glass">
      <div>
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Amount due
        </p>
        <p className="pt-hud-tight font-general text-card-value">
          {formatAmountPretty(BigInt(invoice.amountRaw), invoice.tokenDecimals)}{" "}
          {invoice.tokenSymbol}
        </p>
      </div>

      {!isConnected ? (
        <>
          <p className="font-general text-body-sm leading-body text-chalk/70">
            Connect a wallet to pay this invoice privately.
          </p>
          <ConnectWallet variant="cta" />
        </>
      ) : networkMismatch ? (
        <p role="alert" className="font-general text-body-sm leading-body text-caution">
          Your wallet is connected to {walletNetwork?.label ?? "an unsupported network"}
          , but this invoice is on {invoiceNetwork.label}. Switch networks in your
          wallet to pay.
        </p>
      ) : (
        <>
          {canAttemptPayment ? (
            <>
              {!isProviderConfigured() ? (
                <p className="font-hud-mono text-hud-2xs tracking-hud text-caution">
                  No RPC key is configured here — we can hand you a transaction
                  hash, but cannot confirm it automatically.
                </p>
              ) : null}
              <PressableButton
                type="button"
                interaction={SOLID_CTA}
                onClick={handlePay}
                disabled={busy}
                className={PAY_BUTTON_CLASS}
              >
                {settlement?.phase === "failed" || settlement?.phase === "reverted"
                  ? "Try again"
                  : "Pay privately"}
              </PressableButton>
            </>
          ) : null}

          {settlement ? (
            <SettlementStatus settlement={settlement} network={invoiceNetwork} />
          ) : null}
        </>
      )}

      {saveWarning ? (
        <p role="alert" className="font-hud-mono text-hud-2xs tracking-hud text-caution">
          {saveWarning}
        </p>
      ) : null}
    </div>
  );
};

const SettlementStatus = ({
  settlement,
  network,
}: {
  settlement: Settlement;
  network: NetworkConfig;
}) => {
  const link = settlement.txHash ? (
    <a
      href={explorerTxUrl(network, settlement.txHash)}
      target="_blank"
      rel="noreferrer"
      className="font-hud-mono text-hud-xs tracking-hud text-chalk/70 underline underline-offset-2"
    >
      {shortHex(settlement.txHash)} — view on explorer ↗
    </a>
  ) : null;

  switch (settlement.phase) {
    case "signing":
      return (
        <p className="flex items-center gap-hud-inline font-general text-body-sm leading-body text-chalk/70">
          <PulseDot /> Confirm this payment in your wallet.
        </p>
      );
    case "pending":
      return (
        <div className="flex flex-col gap-hud-tight">
          <p className="flex items-center gap-hud-inline font-general text-body-sm leading-body text-chalk/70">
            <PulseDot /> Verifying the payment. Privacy-pool transfers prove a
            zero-knowledge circuit on-chain — this routinely takes several
            minutes, and is not stuck.
          </p>
          {link}
        </div>
      );
    case "confirmed":
      return (
        <div className="flex flex-col gap-hud-tight">
          <p className="font-general text-body-sm leading-body text-signal">
            Payment confirmed{settlement.status ? ` — ${settlement.status}` : ""}.
          </p>
          {link}
        </div>
      );
    case "reverted":
      return (
        <div className="flex flex-col gap-hud-tight">
          <p className="font-general text-body-sm leading-body text-danger">
            This transaction was rejected on-chain and reverted — nothing was
            paid. You can try again.
          </p>
          {link}
        </div>
      );
    case "unconfirmed":
      return (
        <div className="flex flex-col gap-hud-tight">
          <p className="font-general text-body-sm leading-body text-caution">
            We stopped watching before confirmation came back, but the
            transaction was submitted and may still complete. Check it on the
            explorer before doing anything else — do not pay again from this
            page until you have.
          </p>
          {link}
        </div>
      );
    case "failed":
      return (
        <p role="alert" className="font-general text-body-sm leading-body text-danger">
          The payment could not be sent{settlement.message ? `: ${settlement.message}` : "."}
        </p>
      );
    default:
      return null;
  }
};
