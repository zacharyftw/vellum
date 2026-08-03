"use client";

/**
 * Connected-wallet state.
 *
 * The connection flow lives here rather than in a component so that the UI
 * layer stays presentational and the same flow can be driven from anywhere
 * (connect button, a redirect landing on a payment link, tests).
 */
import { create } from "zustand";
import {
  WalletAccountV6,
  validateAndParseAddress,
  walletV6,
} from "starknet";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { WALLET_API } from "@starknet-io/types-js";

import {
  DEFAULT_NETWORK,
  networkFromChainId,
  providerFor,
  type NetworkConfig,
} from "./networks";

export interface WalletState {
  wallet: WalletWithStarknetFeatures | undefined;
  walletAccount: WalletAccountV6 | undefined;
  /** Checksummed account address, or "" when disconnected. */
  address: string;
  /** Raw chain id reported by the wallet. */
  chainId: string;
  /** Resolved config, or `undefined` when the wallet is on an unsupported chain. */
  network: NetworkConfig | undefined;
  isConnected: boolean;
  /** True while a connection attempt is in flight. */
  isConnecting: boolean;
  /** Last connection error, surfaced by the picker. */
  error: string;

  connect: (wallet: WalletWithStarknetFeatures) => Promise<void>;
  disconnect: () => void;
  /** Re-read the chain id — call after the user switches network in the wallet. */
  refreshChain: () => Promise<void>;
  clearError: () => void;
}

const DISCONNECTED = {
  wallet: undefined,
  walletAccount: undefined,
  address: "",
  chainId: "",
  network: undefined,
  isConnected: false,
} as const;

export const useWalletStore = create<WalletState>()((set, get) => ({
  ...DISCONNECTED,
  isConnecting: false,
  error: "",

  connect: async (wallet) => {
    set({ isConnecting: true, error: "" });
    try {
      // The provider handed to `connect` is fixed for the account's lifetime and
      // can end up pointing at the wrong network once the user switches. Reads
      // go through `providerFor(network)` instead; this one only bootstraps.
      const walletAccount = await WalletAccountV6.connect(
        providerFor(DEFAULT_NETWORK),
        wallet,
      );

      const accounts = await walletV6.requestAccounts(wallet);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error("This wallet did not return an account.");
      }
      const address = validateAndParseAddress(accounts[0]);

      const permissions = await walletV6.getPermissions(wallet);
      const isConnected =
        Array.isArray(permissions) &&
        (permissions as WALLET_API.Permission[]).includes(
          WALLET_API.Permission.ACCOUNTS,
        );
      if (!isConnected) {
        throw new Error("Account permission was not granted.");
      }

      const chainId = (await walletV6.requestChainId(wallet)) as string;

      set({
        wallet,
        walletAccount,
        address,
        chainId,
        network: networkFromChainId(chainId),
        isConnected: true,
      });
    } catch (error) {
      set({
        ...DISCONNECTED,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      set({ isConnecting: false });
    }
  },

  disconnect: () => set({ ...DISCONNECTED, error: "" }),

  refreshChain: async () => {
    const { wallet } = get();
    if (!wallet) return;
    try {
      const chainId = (await walletV6.requestChainId(wallet)) as string;
      set({ chainId, network: networkFromChainId(chainId) });
    } catch {
      // A wallet that cannot answer is not a reason to tear down the session;
      // the network badge keeps its last known value.
    }
  },

  clearError: () => set({ error: "" }),
}));
