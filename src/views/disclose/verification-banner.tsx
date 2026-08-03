import { RevealHeading, RevealText, RevealUnit } from "@/components/motion/reveal";
import type { AnchorKind, AnchorLookup } from "@/lib/starknet/registry";

export interface VerificationBannerProps {
  /** The plaintext reproduces the commitment Vellum recorded. */
  matchesRecord: boolean;
  /**
   * The plaintext reproduces a commitment read back off the chain. Null means
   * the chain could not be consulted — which is not the same as a mismatch.
   */
  matchesChain: boolean | null;
  /** Which commitment the registry holds. Null when the chain was unreachable. */
  anchorKind: AnchorKind | null;
  /** Why the chain answer is what it is, so the reader can judge it. */
  chain: AnchorLookup;
}

/**
 * The verification result.
 *
 * There are two different checks here and conflating them would be the single
 * most damaging thing this page could do.
 *
 * The weak one compares the document against a commitment held in Vellum's own
 * database. It catches accidental corruption and nothing else: a compromised
 * server could store a commitment for a forged document and the check would
 * pass. On its own it is a consistency check, not evidence.
 *
 * The strong one compares the document against a commitment read back from the
 * registry contract. That is the claim an auditor can act on, because it does
 * not require trusting us — and it is only available once a registry is
 * deployed on the invoice's network.
 *
 * When only the weak check has run, this component says so in those words. An
 * earlier version of this page described the database value as "anchored on
 * Starknet" and told the reader it had been "checked against the one on-chain"
 * while making no chain call at all.
 */
export const VerificationBanner = ({
  matchesRecord,
  matchesChain,
  anchorKind,
  chain,
}: VerificationBannerProps) => {
  if (matchesChain === true) {
    // A payment-anchored invoice proves strictly more: the registry's
    // commitment binds the buyer's address as well as the terms, so it also
    // establishes that this specific counterparty settled it.
    const boundToPayer = anchorKind === "payment";
    return (
      <Banner
        tone="strong"
        eyebrow="Verified against Starknet"
        title={
          boundToPayer
            ? "This invoice, and the party who paid it, match the record on-chain."
            : "This invoice matches the fingerprint recorded on-chain."
        }
        body={
          boundToPayer
            ? "Recomputing the Poseidon hash over every field below, the salt, and the buyer's address reproduces the commitment stored in the registry contract. It was written by the privacy pool during settlement, so it establishes both that these terms are unedited and that this buyer is the one who paid them. Verifying it did not require trusting Vellum — the value was read from the chain."
            : "Recomputing the Poseidon hash over every field below, plus the salt, reproduces the commitment stored in the registry contract. Those terms were fixed when that commitment was written and have not been edited since. Verifying this did not require trusting Vellum — the value was read from the chain."
        }
        caveat="This does not confirm that any goods or services were delivered, or that the invoice is otherwise true. The registry records whatever was committed to — it proves immutability, not truth."
      />
    );
  }

  if (matchesChain === false) {
    const absent = chain.status === "absent";
    return (
      <Banner
        tone="alarm"
        eyebrow={absent ? "No on-chain record" : "On-chain mismatch"}
        title={
          absent
            ? "The registry holds no commitment for this invoice."
            : "This document does not match what the registry holds."
        }
        body={
          absent
            ? "The registry contract was queried and returned nothing for this invoice id. Whatever this document is, it was never anchored on-chain — so there is no independent record of when its terms were fixed."
            : "Recomputing the Poseidon hash over the fields below, plus the salt, does not reproduce the commitment stored in the registry. Either this document was altered after that commitment was made, or it was never the document behind it. Do not rely on the contents below without resolving this."
        }
      />
    );
  }

  // The chain could not be consulted. Everything below rests on Vellum's own
  // record, and the wording has to make that impossible to miss.
  const reason =
    chain.status === "unavailable" && chain.reason === "no-registry"
      ? "No registry contract is deployed on this network yet, so there is nothing on-chain to check against."
      : chain.status === "unavailable"
        ? "This page has no RPC access configured, so it could not query the registry."
        : chain.status === "error"
          ? `The registry could not be reached (${chain.message}).`
          : "The registry could not be reached.";

  if (!matchesRecord) {
    return (
      <Banner
        tone="alarm"
        eyebrow="Record mismatch"
        title="This document does not match the fingerprint Vellum recorded."
        body={`Recomputing the Poseidon hash over the fields below, plus the salt, does not reproduce the commitment held for this invoice id. ${reason} Either way, this document is not the one that was recorded — do not rely on it without resolving this.`}
      />
    );
  }

  return (
    <Banner
      tone="provisional"
      eyebrow="Not independently verified"
      title="This invoice matches Vellum's record — but nothing on-chain confirms it."
      body={`Recomputing the Poseidon hash over every field below, plus the salt, reproduces the commitment Vellum holds for this invoice. ${reason}`}
      caveat="That check compares this document against Vellum's own database, so it only rules out accidental corruption. It is not evidence an auditor should rely on: it requires trusting that the recorded commitment was itself honest. Independent verification needs the commitment read from the registry contract."
    />
  );
};

type Tone = "strong" | "provisional" | "alarm";

const TONE: Record<Tone, { border: string; accent: string; shadow: string; dot: string }> = {
  strong: {
    border: "border-signal/40",
    accent: "text-signal",
    shadow: "shadow-signal",
    dot: "bg-signal shadow-signal",
  },
  provisional: {
    border: "border-caution/40",
    accent: "text-caution",
    shadow: "",
    dot: "bg-caution",
  },
  alarm: {
    border: "border-danger/50",
    accent: "text-danger",
    shadow: "",
    dot: "bg-danger",
  },
};

const Banner = ({
  tone,
  eyebrow,
  title,
  body,
  caveat,
}: {
  tone: Tone;
  eyebrow: string;
  title: string;
  body: string;
  caveat?: string;
}) => {
  const style = TONE[tone];
  return (
    <RevealUnit
      tag="section"
      aria-label={`Verification result: ${eyebrow}`}
      className={`rounded-card border ${style.border} bg-surface-raised p-section-sm ${style.shadow}`}
    >
      <p
        className={`flex items-center gap-hud-inline font-hud-mono text-hud-xs tracking-hud uppercase ${style.accent}`}
      >
        <span aria-hidden className={`size-dot rounded-full ${style.dot}`} />
        {eyebrow}
      </p>
      <RevealHeading
        tag="h2"
        delay={80}
        className={`max-w-[36ch] pt-hud-gap font-general text-outro-title leading-title tracking-title ${tone === "alarm" ? "text-danger" : ""}`}
      >
        {title}
      </RevealHeading>
      <RevealText
        delay={200}
        className="max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
      >
        {body}
      </RevealText>
      {caveat ? (
        <RevealText
          delay={320}
          className="max-w-content-copy pt-card font-general text-body-sm leading-body text-chalk/50"
        >
          {caveat}
        </RevealText>
      ) : null}
    </RevealUnit>
  );
};
