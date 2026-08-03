"use client";

/**
 * Discovered Starknet wallets, kept in render state so the picker fills in as
 * extensions register themselves.
 *
 * `eip1193Adapters: []` is load-bearing. Left at its default, discovery bridges
 * EIP-6963 providers and probes MetaMask's Starknet Snap, which makes MetaMask
 * throw an unlock popup over the page repeatedly — before the user has chosen a
 * wallet at all. Passing an empty adapter list keeps MetaMask out of discovery
 * entirely, so only the wallet the user actually picks ever gets a request.
 */
import { useEffect, useState } from "react";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

export function useStarknetWallets(): WalletWithStarknetFeatures[] {
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);

  // Created on mount rather than on picker-open so wallets have time to
  // register before the user gets there — an empty list is almost always a
  // race, not an absent extension.
  useEffect(() => {
    const store: Store = createStore({ eip1193Adapters: [] });
    setWallets(store.getWallets().slice());
    return store.subscribe((next) => setWallets(next.slice()));
  }, []);

  return wallets;
}

/** Normalise a wallet name for matching: "Argent X" → "argentx". */
export function normalizeWalletId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
