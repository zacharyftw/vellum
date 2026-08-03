"use client";

import { animated, useSpring } from "@react-spring/web";
import { useCallback, useEffect, useState } from "react";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

import { PressableButton } from "@/components/ui/pressable";
import {
  useStarknetWallets,
  normalizeWalletId,
} from "@/hooks/use-starknet-wallets";
import { shortHex } from "@/lib/starknet/format";
import { useWalletStore } from "@/lib/starknet/wallet-store";
import { GHOST, HOVER_CONFIG, SOLID_CTA } from "@/lib/springs/interaction";

/**
 * Wallet connection — a picker modal, and the connected-account pill.
 *
 * MetaMask is filtered out of the list rather than merely deprioritised: it has
 * no STRK20 support, and its Snap probing is what `eip1193Adapters: []` in
 * {@link useStarknetWallets} exists to suppress. Every other detected wallet is
 * offered, including ones that may not support STRK20 yet — hiding a wallet the
 * user has installed reads as a bug, so the unsupported case is handled with a
 * message after connecting instead.
 */

export interface ConnectWalletProps {
  /** `cta` is the large filled button; `pill` is the compact header control. */
  variant?: "cta" | "pill";
  className?: string;
}

const PILL_CLASS =
  "inline-flex items-center gap-hud-inline rounded-card border px-cta-x py-cta-y font-hud-mono text-hud-xs tracking-hud uppercase backdrop-blur-glass";

const CTA_CLASS =
  "inline-flex items-center justify-center gap-hud-inline rounded-card px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase shadow-glass";

export const ConnectWallet = ({
  variant = "cta",
  className = "",
}: ConnectWalletProps) => {
  const wallets = useStarknetWallets();
  const isConnected = useWalletStore((state) => state.isConnected);
  const isConnecting = useWalletStore((state) => state.isConnecting);
  const address = useWalletStore((state) => state.address);
  const network = useWalletStore((state) => state.network);
  const error = useWalletStore((state) => state.error);
  const connect = useWalletStore((state) => state.connect);
  const disconnect = useWalletStore((state) => state.disconnect);
  const clearError = useWalletStore((state) => state.clearError);

  const [isPickerOpen, setPickerOpen] = useState(false);

  const pickable = wallets.filter(
    (wallet) => !normalizeWalletId(wallet.name).includes("metamask"),
  );

  const closePicker = useCallback(() => {
    if (isConnecting) return;
    setPickerOpen(false);
    clearError();
  }, [isConnecting, clearError]);

  // Escape closes the picker — a modal that can only be dismissed by clicking a
  // specific spot is a trap for keyboard users.
  useEffect(() => {
    if (!isPickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePicker();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPickerOpen, closePicker]);

  const handleSelect = async (wallet: WalletWithStarknetFeatures) => {
    await connect(wallet);
    // The store clears itself on failure, so a still-connected read here means
    // it worked and the modal's job is done.
    if (useWalletStore.getState().isConnected) setPickerOpen(false);
  };

  if (isConnected && address) {
    return (
      <PressableButton
        type="button"
        interaction={GHOST}
        onClick={disconnect}
        title="Disconnect"
        className={`${PILL_CLASS} ${className}`}
      >
        <span
          aria-hidden
          className={`size-dot rounded-full ${network ? "bg-signal shadow-signal" : "bg-caution"}`}
        />
        {shortHex(address)}
        <span className="text-chalk/50">
          {network ? network.label : "Unsupported network"}
        </span>
      </PressableButton>
    );
  }

  return (
    <>
      <PressableButton
        type="button"
        interaction={variant === "pill" ? GHOST : SOLID_CTA}
        onClick={() => setPickerOpen(true)}
        className={`${variant === "pill" ? PILL_CLASS : CTA_CLASS} ${className}`}
      >
        Connect wallet
      </PressableButton>

      {isPickerOpen ? (
        <WalletPicker
          wallets={pickable}
          isConnecting={isConnecting}
          error={error}
          onSelect={handleSelect}
          onClose={closePicker}
        />
      ) : null}
    </>
  );
};

interface WalletPickerProps {
  wallets: WalletWithStarknetFeatures[];
  isConnecting: boolean;
  error: string;
  onSelect: (wallet: WalletWithStarknetFeatures) => void;
  onClose: () => void;
}

const WalletPicker = ({
  wallets,
  isConnecting,
  error,
  onSelect,
  onClose,
}: WalletPickerProps) => {
  const overlay = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: HOVER_CONFIG,
  });

  return (
    <animated.div
      style={overlay}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 p-hud-gap backdrop-blur-glass"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect a wallet"
        className="w-full max-w-[26rem] rounded-card border border-white/10 bg-surface-raised p-card shadow-glass"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-card">
          <h2 className="font-hud-mono text-hud-sm tracking-hud uppercase">
            Connect a wallet
          </h2>
          <PressableButton
            type="button"
            onClick={onClose}
            disabled={isConnecting}
            aria-label="Close"
            className="font-hud-mono text-hud-md leading-none"
          >
            ×
          </PressableButton>
        </div>

        {wallets.length ? (
          <ul className="flex flex-col gap-hud-tight">
            {wallets.map((wallet) => (
              <li key={wallet.name}>
                <PressableButton
                  type="button"
                  interaction={GHOST}
                  onClick={() => onSelect(wallet)}
                  disabled={isConnecting}
                  className="flex w-full items-center gap-hud-inline rounded-card border px-card-x py-card-y text-left font-general text-body-sm disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={wallet.icon}
                    alt=""
                    className="size-[1.5rem] shrink-0 rounded-[0.25rem]"
                  />
                  <span className="flex-1">{wallet.name}</span>
                  <span aria-hidden className="text-chalk/50">
                    {isConnecting ? "…" : "→"}
                  </span>
                </PressableButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-general text-body-sm leading-body text-chalk/70">
            No Starknet wallet detected. Vellum needs a privacy-enabled wallet —{" "}
            <a
              href="https://www.ready.co/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Ready
            </a>{" "}
            supports STRK20 today.
          </p>
        )}

        {error ? (
          <p
            role="alert"
            className="pt-card font-hud-mono text-hud-xs tracking-hud text-danger"
          >
            {error}
          </p>
        ) : null}
      </div>
    </animated.div>
  );
};
