/**
 * Reading registration state from the STRK20 privacy pool.
 *
 * The pool will not open a payment channel to an address that has never
 * registered a viewing key — `privacy.cairo` asserts `RECIPIENT_NOT_REGISTERED`
 * and the whole transaction reverts. Crucially, registration is its own action:
 * depositing into the pool does not perform it, so a supplier who has funded a
 * shielded balance can still be unpayable.
 *
 * That failure lands on the *buyer*, for a condition only the *supplier* can
 * fix, and the raw revert reason means nothing to a finance team. Checking
 * first turns it into a sentence they can act on.
 *
 * Like `registry.ts`, the result type keeps "the pool says no" apart from "we
 * could not ask" — blocking a payment because a lookup failed would be its own
 * kind of bug.
 */
import { CallData, num } from "starknet";

import { isProviderConfigured, providerFor, type NetworkConfig } from "./networks";

export type RegistrationLookup =
  /** We could not ask. Says nothing about the address. */
  | { status: "unavailable"; reason: "no-pool" | "no-provider" }
  /** The pool holds a viewing key for this address; it can receive. */
  | { status: "registered" }
  /** The pool holds no viewing key; a transfer to it would revert. */
  | { status: "unregistered" }
  | { status: "error"; message: string };

/**
 * Whether an address can receive a private transfer.
 *
 * Never throws — the caller's job is to render the difference between the
 * outcomes, not to catch.
 */
export async function readRegistration(
  network: NetworkConfig,
  address: string,
): Promise<RegistrationLookup> {
  if (!network.poolAddress || network.poolAddress === "0x0") {
    return { status: "unavailable", reason: "no-pool" };
  }
  if (!isProviderConfigured()) {
    return { status: "unavailable", reason: "no-provider" };
  }

  try {
    const result = await providerFor(network.key).callContract({
      contractAddress: network.poolAddress,
      entrypoint: "get_public_key",
      calldata: CallData.compile([address]),
    });

    if (result.length === 0) {
      return { status: "error", message: "The pool returned no value." };
    }
    // Zero is the pool's own "never registered" sentinel: the storage map
    // returns zero for an address it has never seen.
    return num.toBigInt(result[0]) === 0n
      ? { status: "unregistered" }
      : { status: "registered" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
