import { RevealHeading, RevealText, RevealUnit } from "@/components/motion/reveal";
import type { Invoice } from "@/lib/invoice/types";
import type { AnchorLookup } from "@/lib/starknet/registry";

export interface ExplainerPanelProps {
  invoice: Invoice;
  /** The value Vellum recorded — shown beside the recomputed one for a manual check. */
  recordedCommitment: string;
  recomputedCommitment: string;
  /** What the registry returned, so the copy can describe what actually happened. */
  chain: AnchorLookup;
}

/**
 * Plain-language explanation of what this page is and how to check it without
 * trusting it — the salt included, since recomputing the commitment is
 * impossible without it.
 *
 * The copy is conditional on whether the registry was actually reached. An
 * earlier version stated flatly that the hash "is written on Starknet when the
 * invoice is issued" and that this page "checked it against the one on-chain",
 * neither of which was true: no chain call was made, and the value compared
 * against came from Vellum's database.
 */
export const ExplainerPanel = ({
  invoice,
  recordedCommitment,
  recomputedCommitment,
  chain,
}: ExplainerPanelProps) => (
  <RevealUnit
    tag="section"
    aria-label="How to verify this independently"
    className="rounded-card border border-white/10 bg-surface p-section-sm"
  >
    <RevealHeading
      tag="h2"
      className="font-general text-faq-question leading-title tracking-title"
    >
      What you are looking at
    </RevealHeading>
    <RevealText
      delay={80}
      className="max-w-content-copy pt-hud-gap font-general text-body-sm leading-body text-chalk/70"
    >
      Every invoice on Vellum is hashed — the amount, both parties, the line
      items, the dates, and a random salt, all folded into one Poseidon hash.
      The hash alone discloses nothing: without the salt below, nobody could
      confirm even a correct guess at the amount. This page decrypted the
      invoice using the key from its own link and recomputed that hash from the
      plaintext.{" "}
      {chain.status === "found"
        ? "It then read the commitment back out of the registry contract on Starknet and compared the two — so the comparison did not depend on trusting Vellum."
        : chain.status === "absent"
          ? "The registry contract was queried and holds nothing for this invoice id, so there was no on-chain value to compare against."
          : chain.status === "error"
            ? "The registry contract could not be reached, so the only comparison available was against the commitment Vellum has on file — which requires trusting Vellum."
            : chain.reason === "no-registry"
              ? "No registry contract is deployed on this network yet, so the only comparison available was against the commitment Vellum has on file — which requires trusting Vellum. Once the registry is live, this page reads the value from the chain instead."
              : "This page has no RPC access configured, so the only comparison available was against the commitment Vellum has on file — which requires trusting Vellum."}
    </RevealText>

    <RevealHeading
      tag="h2"
      delay={160}
      className="pt-section-sm font-general text-faq-question leading-title tracking-title"
    >
      Checking it yourself
    </RevealHeading>
    <RevealText
      delay={240}
      className="max-w-content-copy pt-hud-gap font-general text-body-sm leading-body text-chalk/70"
    >
      You do not have to take this page&apos;s word for it. Take the invoice
      fields above, the salt below, and the invoice id, and compute the same
      Poseidon hash yourself — the formula is in{" "}
      <code className="rounded-card bg-surface-raised px-hud-inline py-hud-tight font-hud-mono text-hud-2xs">
        src/lib/invoice/commitment.ts
      </code>{" "}
      in the Vellum source. Compare your result against the registry
      contract&apos;s stored commitment — read directly from a Starknet node you
      choose, not from this page. If they match, this document is the one that
      was committed to. If they don&apos;t, don&apos;t trust this page&apos;s
      verdict over your own.
    </RevealText>

    <div className="grid grid-cols-2 gap-hud-gap pt-section-sm max-sm:grid-cols-1">
      <div className="rounded-card border border-white/10 bg-surface-raised p-card-x py-card-y">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Commitment salt
        </p>
        <p className="break-all pt-hud-tight font-hud-mono text-hud-xs leading-body text-chalk/80">
          {invoice.salt}
        </p>
      </div>
      <div className="rounded-card border border-white/10 bg-surface-raised p-card-x py-card-y">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Invoice id
        </p>
        <p className="break-all pt-hud-tight font-hud-mono text-hud-xs leading-body text-chalk/80">
          {invoice.id}
        </p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-hud-gap pt-hud-gap max-sm:grid-cols-1">
      <div className="rounded-card border border-white/10 bg-surface-raised p-card-x py-card-y">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          {chain.status === "found" ? "Read from the registry" : "Recorded by Vellum"}
        </p>
        <p className="break-all pt-hud-tight font-hud-mono text-hud-xs leading-body text-chalk/80">
          {chain.status === "found" ? chain.anchor.commitment : recordedCommitment}
        </p>
      </div>
      <div className="rounded-card border border-white/10 bg-surface-raised p-card-x py-card-y">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
          Recomputed from this document
        </p>
        <p className="break-all pt-hud-tight font-hud-mono text-hud-xs leading-body text-chalk/80">
          {recomputedCommitment}
        </p>
      </div>
    </div>
  </RevealUnit>
);
