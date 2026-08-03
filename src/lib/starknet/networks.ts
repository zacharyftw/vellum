/**
 * Starknet network configuration.
 *
 * The STRK20 starter kit addressed networks by array index (`providers[0]` =
 * Mainnet, `providers[2]` = Sepolia) and passed that index around the UI. That
 * is a bug factory — index `1` was a spare endpoint with no privacy pool, and
 * every call site had to remember which number meant what. Here networks are
 * keyed by name and the chain ID is the lookup, so a wrong network is a type
 * error rather than a silently doomed transaction.
 */
import { RpcProvider, constants as snConstants } from "starknet";

import { publicEnv } from "@/env";

/** Networks where the STRK20 privacy pool is deployed. */
export type NetworkKey = "mainnet" | "sepolia";

export interface NetworkConfig {
  key: NetworkKey;
  /** Shown in the UI. */
  label: string;
  /** Starknet chain ID as returned by `walletV6.requestChainId`. */
  chainId: string;
  /** JSON-RPC endpoint. Alchemy needs `NEXT_PUBLIC_PROVIDER_URL` appended. */
  nodeUrl: string;
  /** Block explorer origin, for receipt links. */
  explorer: string;
  /** Deployed `InvoiceRegistry`. "0x0" means not deployed on this network. */
  registryAddress: string;
  /**
   * The STRK20 privacy pool.
   *
   * The app never needs this to *send* — the wallet substitutes `${poolAddress}`
   * itself during assembly. It is only needed to *read*: checking whether a
   * recipient has registered a viewing key before letting someone pay them.
   * "0x0" disables that pre-flight check rather than blocking payment.
   */
  poolAddress: string;
  /** The ERC-20 invoices are denominated and settled in. */
  tokenAddress: string;
  /** Decimals of `tokenAddress` — STRK is 18. */
  tokenDecimals: number;
  tokenSymbol: string;
}

/**
 * STRK on Mainnet. Sepolia uses the same address — the token is deployed at a
 * matching address on both networks.
 */
const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

const ALCHEMY_KEY = (publicEnv.NEXT_PUBLIC_PROVIDER_URL ?? "").trim();

/**
 * Whether an RPC key is configured.
 *
 * Without one the app still renders — you can write an invoice, encrypt it, and
 * read the docs. Only the calls that touch a node fail, and they should say so
 * where the user tried to make them.
 */
export function isProviderConfigured(): boolean {
  return ALCHEMY_KEY !== "";
}

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  mainnet: {
    key: "mainnet",
    label: "Mainnet",
    chainId: snConstants.StarknetChainId.SN_MAIN,
    nodeUrl: `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/${ALCHEMY_KEY}`,
    explorer: "https://voyager.online",
    registryAddress: publicEnv.NEXT_PUBLIC_INVOICE_REGISTRY_MAINNET ?? "0x0",
    poolAddress: publicEnv.NEXT_PUBLIC_STRK20_POOL_MAINNET ?? "0x0",
    tokenAddress: STRK_ADDRESS,
    tokenDecimals: 18,
    tokenSymbol: "STRK",
  },
  sepolia: {
    key: "sepolia",
    label: "Sepolia",
    chainId: snConstants.StarknetChainId.SN_SEPOLIA,
    nodeUrl: `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/${ALCHEMY_KEY}`,
    explorer: "https://sepolia.voyager.online",
    registryAddress: publicEnv.NEXT_PUBLIC_INVOICE_REGISTRY_SEPOLIA ?? "0x0",
    poolAddress: publicEnv.NEXT_PUBLIC_STRK20_POOL_SEPOLIA ?? "0x0",
    tokenAddress: STRK_ADDRESS,
    tokenDecimals: 18,
    tokenSymbol: "STRK",
  },
};

/** Network used for wallet connection and as the default everywhere else. */
export const DEFAULT_NETWORK: NetworkKey = "sepolia";

/** Resolve a wallet-reported chain ID to a supported network, or `undefined`. */
export function networkFromChainId(
  chainId: string | undefined,
): NetworkConfig | undefined {
  if (!chainId) return undefined;
  return Object.values(NETWORKS).find((n) => n.chainId === chainId);
}

/**
 * RPC providers, memoised per network.
 *
 * A `WalletAccountV6`'s own provider is fixed at connect time and can point at
 * the wrong network after the user switches in their wallet. Reads (receipts,
 * balances, registry calls) go through these instead.
 */
const providerCache = new Map<NetworkKey, RpcProvider>();

export function providerFor(network: NetworkKey): RpcProvider {
  let provider = providerCache.get(network);
  if (!provider) {
    provider = new RpcProvider({ nodeUrl: NETWORKS[network].nodeUrl });
    providerCache.set(network, provider);
  }
  return provider;
}

/** Whether an `InvoiceRegistry` is deployed on this network. */
export function hasRegistry(network: NetworkConfig): boolean {
  const addr = network.registryAddress.trim();
  return addr !== "" && addr !== "0x0" && addr !== "0x00";
}

/** Explorer URL for a transaction hash on a given network. */
export function explorerTxUrl(network: NetworkConfig, txHash: string): string {
  return `${network.explorer}/tx/${txHash}`;
}

/** Explorer URL for a contract address on a given network. */
export function explorerContractUrl(
  network: NetworkConfig,
  address: string,
): string {
  return `${network.explorer}/contract/${address}`;
}
