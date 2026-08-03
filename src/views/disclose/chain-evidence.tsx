import type { ReactNode } from "react";

import { RevealHeading, RevealUnit } from "@/components/motion/reveal";
import { PressableLink } from "@/components/ui/pressable";
import { TEXT_LINK } from "@/lib/springs/interaction";
import type { StoredInvoice } from "@/lib/invoice/schemas";
import { NETWORKS, explorerContractUrl, explorerTxUrl, hasRegistry } from "@/lib/starknet/networks";
import type { AnchorLookup } from "@/lib/starknet/registry";
import { shortHex } from "@/lib/starknet/format";

import { formatDateTime } from "./format-date";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-hud-tight border-t border-white/10 py-card first:border-t-0">
    <dt className="font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
      {label}
    </dt>
    <dd className="font-hud-mono text-hud-sm break-all">{children}</dd>
  </div>
);

const ExplorerLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <PressableLink
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    interaction={TEXT_LINK}
    className="underline underline-offset-4"
  >
    {children}
  </PressableLink>
);

export interface ChainEvidenceProps {
  stored: StoredInvoice;
  chain: AnchorLookup;
}

/**
 * The paper trail, separated by where each value came from.
 *
 * The distinction is the point. A transaction hash held in Vellum's database
 * is a *reference*, not evidence: the endpoint that records it is
 * unauthenticated by design — the invoice id is the only credential — so
 * anyone holding an id can point it at any transaction they like. Only the
 * block that the registry contract itself returns is evidence, and that is
 * labelled separately and only when the chain actually answered.
 */
export const ChainEvidence = ({ stored, chain }: ChainEvidenceProps) => {
  const network = NETWORKS[stored.network];

  return (
    <RevealUnit
      tag="section"
      aria-label="Record and on-chain evidence"
      className="rounded-card border border-white/10 bg-surface-raised p-section-sm shadow-glass"
    >
      <RevealHeading
        tag="h2"
        className="font-general text-faq-question leading-title tracking-title"
      >
        Where these values come from
      </RevealHeading>

      {chain.status === "found" ? (
        <>
          <p className="pt-hud-gap font-hud-mono text-hud-xs tracking-hud uppercase text-signal">
            Read from the registry contract
          </p>
          <dl className="pt-hud-tight">
            <Row label="Commitment on-chain">
              <span title={chain.anchor.commitment}>
                {shortHex(chain.anchor.commitment, 10, 8)}
              </span>
            </Row>
            <Row label="Anchored at">
              {formatDateTime(new Date(chain.anchor.anchoredAt * 1000).toISOString())}
            </Row>
            <Row label="Settled on-chain">
              {chain.anchor.paidAt !== null ? (
                formatDateTime(new Date(chain.anchor.paidAt * 1000).toISOString())
              ) : (
                <span className="font-general text-body-sm font-normal text-chalk/50">
                  The registry records no settlement for this invoice.
                </span>
              )}
            </Row>
          </dl>
        </>
      ) : (
        <p className="pt-hud-gap font-general text-body-sm leading-body text-caution">
          {chain.status === "absent"
            ? "The registry was queried and holds no record for this invoice id."
            : chain.status === "error"
              ? `The registry could not be reached (${chain.message}), so nothing below was confirmed on-chain.`
              : chain.reason === "no-registry"
                ? "No registry contract is deployed on this network yet, so none of the values below have been confirmed on-chain."
                : "No RPC access is configured here, so none of the values below have been confirmed on-chain."}
        </p>
      )}

      <p className="pt-section-sm font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50">
        Recorded by Vellum — references, not evidence
      </p>
      <dl className="pt-hud-tight">
        <Row label="Network">{network.label}</Row>

        <Row label="Recorded commitment">
          <span title={stored.commitment}>{shortHex(stored.commitment, 10, 8)}</span>
        </Row>

        <Row label="Anchor transaction">
          {stored.anchorTxHash ? (
            <ExplorerLink href={explorerTxUrl(network, stored.anchorTxHash)}>
              {shortHex(stored.anchorTxHash, 10, 8)}
            </ExplorerLink>
          ) : (
            <span className="font-general text-body-sm font-normal text-chalk/50">
              None recorded.
            </span>
          )}
        </Row>

        <Row label="Settlement">
          {stored.settlementTxHash ? (
            <ExplorerLink href={explorerTxUrl(network, stored.settlementTxHash)}>
              {shortHex(stored.settlementTxHash, 10, 8)}
            </ExplorerLink>
          ) : (
            <span className="font-general text-body-sm font-normal text-chalk/50">
              Not yet settled.
            </span>
          )}
        </Row>

        {stored.paidAt ? (
          <Row label="Settled at">{formatDateTime(stored.paidAt)}</Row>
        ) : null}

        {hasRegistry(network) ? (
          <Row label="Registry contract">
            <ExplorerLink href={explorerContractUrl(network, network.registryAddress)}>
              {shortHex(network.registryAddress, 10, 8)}
            </ExplorerLink>
          </Row>
        ) : null}
      </dl>
    </RevealUnit>
  );
};
