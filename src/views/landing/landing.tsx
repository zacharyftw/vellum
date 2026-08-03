import Image from "next/image";

import {
  RevealCard,
  RevealHeading,
  RevealText,
  RevealUnit,
} from "@/components/motion/reveal";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { PressableLink } from "@/components/ui/pressable";
import { GHOST, SOLID_CTA } from "@/lib/springs/interaction";

import {
  HERO_PHOTO,
  INVENTORY_PHOTO,
  LOGISTICS_PHOTO,
  MANUFACTURING_PHOTO,
  type Photo,
} from "./imagery";

/**
 * The marketing page.
 *
 * The argument it has to win is that a public chain takes away the
 * confidentiality your business already has with its bank. So the leaks come
 * first, in the buyer's own terms, and the cryptography is never named above
 * the fold.
 *
 * Stays a Server Component: the reveals and the wallet control are the only
 * client leaves.
 */

/** Milliseconds between one card's reveal and the next in the same row. */
const CARD_STAGGER = 110;

const LEAKS: { photo: Photo; title: string; body: string }[] = [
  {
    photo: MANUFACTURING_PHOTO,
    title: "Your prices stop being yours",
    body: "Volume discounts are a trade secret. Settle in public and every customer can see they are paying more than the last one, and ask why. No supplier can operate that way.",
  },
  {
    photo: LOGISTICS_PHOTO,
    title: "Your supply chain becomes readable",
    body: "Who you buy from reveals your margins, your capacity, and the product you have not announced yet. A competitor watching one address gets all of it for free.",
  },
  {
    photo: INVENTORY_PHOTO,
    title: "Your order flow is a forecast",
    body: "A ten-fold jump in component orders tells the market what is coming, months before you meant to say it. Timing is a signal even when amounts are not.",
  },
];

const STEPS: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Issue",
    body: "Fill in the invoice. It is encrypted in your browser before it goes anywhere, and the key is put in the link — not in our database.",
  },
  {
    step: "02",
    title: "Send",
    body: "Your customer opens the link and reads the invoice. We hold the ciphertext and cannot read a line of it.",
  },
  {
    step: "03",
    title: "Settle",
    body: "They pay from a shielded balance. The amount and both parties stay private. The invoice is marked paid in the same transaction, so the two can never disagree.",
  },
  {
    step: "04",
    title: "Prove",
    body: "When an auditor, a lender, or a court asks, disclose that one payment, and nothing else.",
  },
];

export const LandingView = () => {
  return (
    <main>
      <Hero />
      <Leaks />
      <HowItWorks />
      <Disclosure />
    </main>
  );
};

const Hero = () => (
  <section className="relative flex min-h-svh items-end overflow-hidden">
    <Image
      src={HERO_PHOTO.src}
      alt={HERO_PHOTO.alt}
      fill
      priority
      sizes="100vw"
      className="object-cover"
    />
    {/* The photograph is atmosphere, not information — it sits under enough
        violet that body copy stays legible over its brightest region. */}
    <div
      aria-hidden
      className="absolute inset-0 bg-gradient-to-t from-void via-void/90 to-void/60"
    />

    <div className="relative mx-auto w-full max-w-content px-hud-x pb-section max-lg:px-hud-x-sm">
      <RevealUnit
        tag="p"
        className="flex items-center gap-hud-inline font-hud-mono text-hud-xs tracking-hud uppercase text-signal"
      >
        <span aria-hidden className="size-dot rounded-full bg-signal shadow-signal" />
        Private settlement on Starknet
      </RevealUnit>

      <RevealHeading
        tag="h1"
        delay={150}
        className="max-w-[20ch] pt-hud-gap font-general text-hud-title leading-title tracking-title text-shadow-title"
      >
        Invoice. Get paid. Reveal nothing.
      </RevealHeading>

      <RevealText
        delay={420}
        className="max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
      >
        Businesses do not publish what they charge, who they buy from, or what
        they ordered last quarter. Vellum keeps it that way, and still lets you
        prove any single payment to anyone who has a right to ask.
      </RevealText>

      <RevealUnit
        delay={700}
        className="flex flex-wrap items-center gap-hud-gap pt-section-sm"
      >
        <PressableLink
          href="/create"
          interaction={SOLID_CTA}
          className="inline-flex items-center gap-hud-inline rounded-card px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase shadow-glass"
        >
          Issue an invoice
          <span aria-hidden>→</span>
        </PressableLink>
        <ConnectWallet variant="pill" />
      </RevealUnit>
    </div>
  </section>
);

const Leaks = () => (
  <section
    id="why"
    className="mx-auto w-full max-w-content px-hud-x py-section max-lg:px-hud-x-sm"
  >
    <RevealHeading className="max-w-[24ch] font-general text-outro-title leading-title tracking-title">
      What a public ledger gives away
    </RevealHeading>
    <RevealText
      delay={200}
      className="max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
    >
      This is why procurement runs on private infrastructure today, and why it
      has stayed off public chains.
    </RevealText>

    {/* `perspective` + `origin-bottom` let CARD_REVEAL's rotateX read as a tilt
        rather than a vertical squash. */}
    <ul className="grid grid-cols-3 gap-hud-gap pt-section-sm [perspective:1200px] max-lg:grid-cols-1">
      {LEAKS.map((leak, index) => (
        <RevealCard
          key={leak.title}
          delay={index * CARD_STAGGER}
          className="origin-bottom overflow-hidden rounded-card border border-white/10 bg-surface shadow-glass"
        >
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={leak.photo.src}
              alt={leak.photo.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-surface to-transparent"
            />
          </div>
          <div className="p-card-x pb-card-x">
            <h3 className="font-general text-faq-question leading-title tracking-title">
              {leak.title}
            </h3>
            <p className="pt-card font-general text-body-sm leading-body text-chalk/70">
              {leak.body}
            </p>
          </div>
        </RevealCard>
      ))}
    </ul>
  </section>
);

const HowItWorks = () => (
  <section
    id="how"
    className="mx-auto w-full max-w-content px-hud-x py-section max-lg:px-hud-x-sm"
  >
    <RevealHeading className="font-general text-outro-title leading-title tracking-title">
      How it works
    </RevealHeading>

    <ol className="grid grid-cols-4 gap-hud-gap pt-section-sm [perspective:1200px] max-lg:grid-cols-2 max-sm:grid-cols-1">
      {STEPS.map((step, index) => (
        <RevealCard
          key={step.step}
          delay={index * CARD_STAGGER}
          className="origin-bottom rounded-card border border-white/10 bg-surface-raised p-card-x shadow-glass"
        >
          <p className="font-hud-mono text-hud-xs tracking-hud text-signal">
            {step.step}
          </p>
          <h3 className="pt-card font-general text-faq-question leading-title tracking-title">
            {step.title}
          </h3>
          <p className="pt-card font-general text-body-sm leading-body text-chalk/70">
            {step.body}
          </p>
        </RevealCard>
      ))}
    </ol>
  </section>
);

const Disclosure = () => (
  <section
    id="disclosure"
    className="mx-auto w-full max-w-content px-hud-x py-section max-lg:px-hud-x-sm"
  >
    <RevealUnit className="rounded-card border border-signal/30 bg-surface-raised p-section-sm shadow-glass">
      <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-signal">
        Disclosure
      </p>
      <RevealHeading
        delay={120}
        className="max-w-[26ch] pt-hud-gap font-general text-outro-title leading-title tracking-title"
      >
        Private is not the same as unaccountable
      </RevealHeading>
      <RevealText
        delay={300}
        className="max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
      >
        Every invoice is anchored on-chain as a salted hash — a number that
        discloses nothing on its own. Hand an auditor the invoice and they can
        recompute that hash and watch it match, which proves the terms were
        fixed before payment and never edited since.
      </RevealText>
      <RevealText
        delay={420}
        className="max-w-content-copy pt-card font-general text-body leading-body text-chalk/70"
      >
        They learn about that one invoice. Not the one before it, not the price
        you gave anyone else, not who else you trade with. This is how a bank
        already works.
      </RevealText>

      <RevealUnit
        delay={560}
        className="flex flex-wrap items-center gap-hud-gap pt-section-sm"
      >
        <PressableLink
          href="/create"
          interaction={SOLID_CTA}
          className="inline-flex items-center gap-hud-inline rounded-card px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase shadow-glass"
        >
          Issue an invoice
          <span aria-hidden>→</span>
        </PressableLink>
        <PressableLink
          href="/dashboard"
          interaction={GHOST}
          className="inline-flex items-center gap-hud-inline rounded-card border px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase backdrop-blur-glass"
        >
          Open dashboard
        </PressableLink>
      </RevealUnit>
    </RevealUnit>
  </section>
);
