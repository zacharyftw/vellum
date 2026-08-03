"use client";

/**
 * Auditor disclosure — "prove this one payment to my accountant, and nothing
 * else."
 *
 * Reached at `/disclose/<id>#k=<key>`, the same fragment-key scheme as the
 * payment link: the key never leaves the browser that opened this page, and
 * the server holding the ciphertext never sees it either. Everything below
 * the verification banner is decrypted client-side from that key, which is
 * why this view — unlike most of the app — is a client component almost top
 * to bottom rather than a server shell with client leaves. There is nothing
 * here to render on the server; the plaintext does not exist until the
 * browser makes it.
 */
import { Handle } from "@/components/animation/springs/handle";
import { RevealHeading, RevealUnit } from "@/components/motion/reveal";
import { PressableButton } from "@/components/ui/pressable";
import { invoiceStatus } from "@/lib/invoice/status";
import { GHOST } from "@/lib/springs/interaction";
import { shortHex } from "@/lib/starknet/format";

import { ChainEvidence } from "./chain-evidence";
import { ExplainerPanel } from "./explainer-panel";
import { InvoiceDocument } from "./invoice-document";
import { StatusPanel } from "./status-panel";
import { useDisclosure } from "./use-disclosure";
import { VerificationBanner } from "./verification-banner";

export interface DiscloseViewProps {
  id: string;
}

export const DiscloseView = ({ id }: DiscloseViewProps) => {
  const state = useDisclosure(id);

  return (
    <main className="mx-auto min-h-svh w-full max-w-content px-hud-x pt-[calc(var(--spacing-section)+var(--spacing-hud-gap)+var(--spacing-hud-y))] pb-section max-lg:px-hud-x-sm">
      <RevealUnit
        tag="p"
        className="flex items-center gap-hud-inline font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/50"
      >
        <span aria-hidden className="size-dot rounded-full bg-signal shadow-signal" />
        Auditor disclosure · {shortHex(id, 8, 6)}
      </RevealUnit>

      <RevealHeading
        tag="h1"
        delay={120}
        className="max-w-[24ch] pt-hud-gap font-general text-hud-title leading-title tracking-title"
      >
        Prove one payment. Reveal nothing else.
      </RevealHeading>

      <Handle
        tag="div"
        className="pt-section-sm"
        from={{ opacity: 0, y: 8 }}
        to={{ opacity: 1, y: 0 }}
      >
        {state.phase === "loading" ? (
          <p role="status" className="font-hud-mono text-hud-sm tracking-hud text-chalk/50 uppercase">
            Decrypting invoice…
          </p>
        ) : state.phase === "no-key" ? (
          <StatusPanel
            tone="neutral"
            eyebrow="Missing key"
            heading="No key in this link"
            body="This page needs the decryption key that normally rides after the # in the URL — for example …/disclose/0xabc#k=…. Without it there is nothing to show: the invoice is stored encrypted, and the server hosting this page cannot read it either. Ask whoever sent you this link to resend it in full, and check that nothing after the # got dropped along the way (some chat apps and email clients trim it)."
          />
        ) : state.phase === "not-found" ? (
          <StatusPanel
            tone="neutral"
            eyebrow="Not found"
            heading="No invoice at this address"
            body={`There is no invoice with id ${id} on file. The link may be mistyped, or it may point at a different environment than this one.`}
          />
        ) : state.phase === "load-error" ? (
          <StatusPanel
            tone="caution"
            eyebrow="Could not load"
            heading="This invoice could not be loaded"
            body={`${state.message} Try reloading the page — if it keeps happening, the problem is on our end, not with the invoice or the link.`}
          />
        ) : state.phase === "undecryptable" ? (
          <StatusPanel
            tone="danger"
            eyebrow="Decryption failed"
            heading="This key does not open this invoice"
            body="Decryption failed. AES-GCM fails closed on both a wrong key and a tampered record, so there is no way to tell those two apart from here — only that this link and this stored invoice do not agree. Confirm you have the exact link the issuer sent, with nothing dropped from the part after the #. If you do, the record itself may have been altered, which is worth raising with whoever issued it."
          />
        ) : (
          <div className="flex flex-col gap-section-sm">
            <div className="flex justify-end">
              <PressableButton
                type="button"
                onClick={() => window.print()}
                interaction={GHOST}
                className="inline-flex items-center gap-hud-inline rounded-card border px-cta-x py-cta-y font-hud-mono text-hud-xs tracking-hud uppercase backdrop-blur-glass"
              >
                Print / save as PDF
              </PressableButton>
            </div>

            <VerificationBanner
              matchesRecord={state.matchesRecord}
              matchesChain={state.matchesChain}
              anchorKind={state.anchorKind}
              chain={state.chain}
            />

            <InvoiceDocument
              invoice={state.invoice}
              status={invoiceStatus({
                dueAt: state.invoice.dueAt,
                isPaid: state.stored.settlementTxHash !== null,
              })}
            />

            <ChainEvidence stored={state.stored} chain={state.chain} />

            <ExplainerPanel
              invoice={state.invoice}
              recordedCommitment={state.stored.commitment}
              recomputedCommitment={state.recomputedCommitment}
              chain={state.chain}
            />
          </div>
        )}
      </Handle>
    </main>
  );
};
