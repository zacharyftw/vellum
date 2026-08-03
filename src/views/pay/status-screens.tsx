/**
 * The non-invoice states this page can land on: still loading, the link is
 * missing its key, the id does not exist, the ciphertext would not decrypt, or
 * the fetch itself failed. Every one of these is a normal thing to happen to a
 * link that gets forwarded, bookmarked, and pasted around — none of them are a
 * crash, and each says plainly what went wrong and what to do about it.
 */
import type { ReactNode } from "react";

import { PressableButton } from "@/components/ui/pressable";
import { GHOST } from "@/lib/springs/interaction";

import { FadeIn, PulseDot } from "./fade-in";

const MessageCard = ({
  eyebrow,
  eyebrowClass = "text-chalk/50",
  title,
  children,
  action,
}: {
  eyebrow: string;
  eyebrowClass?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) => (
  <FadeIn className="mx-auto w-full max-w-content-copy rounded-card border border-white/10 bg-surface-raised p-card-x py-section-sm text-center shadow-glass">
    <p className={`font-hud-mono text-hud-xs tracking-hud uppercase ${eyebrowClass}`}>
      {eyebrow}
    </p>
    <h1 className="pt-hud-gap font-general text-faq-question leading-title tracking-title">
      {title}
    </h1>
    {children ? (
      <div className="pt-hud-gap font-general text-body-sm leading-body text-chalk/70">
        {children}
      </div>
    ) : null}
    {action ? <div className="pt-section-sm">{action}</div> : null}
  </FadeIn>
);

export const LoadingScreen = () => (
  <MessageCard eyebrow="Opening" title="Reading the invoice">
    <PulseDot className="mx-auto" />
  </MessageCard>
);

export const NoKeyScreen = () => (
  <MessageCard
    eyebrow="Link incomplete"
    eyebrowClass="text-caution"
    title="This link is missing its key"
  >
    <p>
      A Vellum invoice link carries its decryption key after the{" "}
      <code className="font-hud-mono text-chalk">#</code> — the part that never
      reaches our server, which is what keeps the invoice private. Something
      along the way dropped it: an email client rewriting the link, a chat app
      unfurling it, or a copy that only grabbed part of the URL.
    </p>
    <p className="pt-hud-gap">
      Ask whoever sent this for the original link, copied in full.
    </p>
  </MessageCard>
);

export const NotFoundScreen = () => (
  <MessageCard
    eyebrow="Not found"
    eyebrowClass="text-caution"
    title="We don't have this invoice"
  >
    <p>
      There is no invoice at this address. The link may be mistyped, or it may
      point at one that no longer exists.
    </p>
  </MessageCard>
);

export const DecryptFailedScreen = () => (
  <MessageCard
    eyebrow="Could not open"
    eyebrowClass="text-danger"
    title="This invoice will not decrypt"
  >
    <p>
      The key in this link does not open what is stored on our server — either
      it is the wrong key, or the data was altered after it was encrypted.
      Encryption here fails closed: there is no partially-readable version to
      fall back to.
    </p>
    <p className="pt-hud-gap">Ask the supplier to resend the link.</p>
  </MessageCard>
);

export const LoadErrorScreen = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <MessageCard
    eyebrow="Something went wrong"
    eyebrowClass="text-danger"
    title="We could not load this invoice"
    action={
      <PressableButton
        type="button"
        interaction={GHOST}
        onClick={onRetry}
        className="inline-flex items-center gap-hud-inline rounded-card border px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase backdrop-blur-glass"
      >
        Try again
      </PressableButton>
    }
  >
    <p>{message}</p>
  </MessageCard>
);
