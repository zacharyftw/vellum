/**
 * Turning STRK20 revert reasons into sentences a finance team can act on.
 *
 * A reverted privacy-pool transaction surfaces a Cairo error constant like
 * `RECIPIENT_NOT_REGISTERED` buried in a stack of proof and syscall noise. That
 * string is precise and completely useless to the person holding the invoice:
 * it does not say who has to do what, and several of the likeliest failures are
 * fixable only by the *other* party.
 *
 * Only errors a user can actually act on are translated. Anything else keeps
 * its original text — inventing a friendly message for a condition we have not
 * understood would hide the one clue worth having.
 */

interface Translation {
  /** What went wrong, in plain language. */
  message: string;
  /** What to do about it, when there is something. */
  action?: string;
}

/**
 * Matched as substrings against the raw error. Revert reasons arrive wrapped in
 * varying amounts of surrounding text depending on wallet and node, so an
 * equality check would miss most real failures.
 */
const TRANSLATIONS: Record<string, Translation> = {
  RECIPIENT_NOT_REGISTERED: {
    message:
      "The supplier's account has not been set up to receive private payments yet.",
    action:
      "Only they can fix this — ask them to enable private payments in their wallet, then try again. Nothing was charged.",
  },
  SENDER_NOT_REGISTERED: {
    message: "Your account has not been set up for private payments yet.",
    action:
      "Enable private payments in your wallet, then try again. Nothing was charged.",
  },
  SENDER_NOT_AUTHENTICATED: {
    message: "Your wallet could not prove ownership of this shielded account.",
    action: "Reconnect your wallet and try again.",
  },
  NEGATIVE_INTERMEDIATE_BALANCE: {
    message: "Your shielded balance is too small to cover this invoice.",
    action: "Move more funds into the privacy pool, then try again.",
  },
  ZERO_AMOUNT: {
    message: "This invoice has no amount to pay.",
  },
  NOTE_NOT_FOUND: {
    message: "Your wallet referenced shielded funds the pool could not find.",
    action:
      "This usually means your wallet is out of sync — resync it and try again.",
  },
  PROOF_EXPIRED: {
    message: "The privacy proof expired before the network accepted it.",
    action: "Try again — nothing was charged.",
  },
  INVALID_PROOF_MSG: {
    message: "The network rejected the privacy proof for this payment.",
    action: "Try again. If it keeps happening, your wallet may need updating.",
  },
  TOKEN_MISMATCH: {
    message: "This payment referenced the wrong token.",
  },
};

/** Wallet rejections are not failures worth alarming anyone about. */
const REJECTION_PATTERNS = [
  "user rejected",
  "user abort",
  "rejected by user",
  "user denied",
  "declined",
];

export interface DescribedError {
  message: string;
  action?: string;
  /** True when the user dismissed the wallet prompt rather than hitting a fault. */
  isRejection: boolean;
  /** The untranslated text, kept so it can be shown on request. */
  raw: string;
}

export function describeStrk20Error(error: unknown): DescribedError {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (REJECTION_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return {
      message: "You dismissed the payment in your wallet.",
      isRejection: true,
      raw,
    };
  }

  for (const [code, translation] of Object.entries(TRANSLATIONS)) {
    if (raw.includes(code)) {
      return { ...translation, isRejection: false, raw };
    }
  }

  return { message: raw, isRejection: false, raw };
}
