import { RevealHeading, RevealText, RevealUnit } from "@/components/motion/reveal";
import { PressableLink } from "@/components/ui/pressable";
import { SOLID_CTA } from "@/lib/springs/interaction";

/**
 * What most first-time visitors see.
 *
 * A dashboard that reads from `localStorage` is empty on every browser that
 * has not issued or opened an invoice yet — including the first visit after
 * shipping this feature. That is not a broken state; it is explained here
 * rather than left to look like one.
 */
export const DashboardEmpty = () => (
  <RevealUnit className="rounded-card border border-white/10 bg-surface-raised p-section-sm text-center shadow-glass">
    <p className="font-hud-mono text-hud-xs tracking-hud text-signal uppercase">
      No invoices yet
    </p>
    <RevealHeading
      tag="h2"
      delay={100}
      className="mx-auto max-w-[26ch] pt-hud-gap font-general text-outro-title leading-title tracking-title"
    >
      Nothing to show — yet
    </RevealHeading>
    <RevealText
      delay={260}
      className="mx-auto max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
    >
      Invoices show up here the moment you issue one, or open one someone sent
      you. There is no account behind this list — it is built from what this
      browser has seen, because the server holds ciphertext and never learns
      whose invoices they are.
    </RevealText>
    <RevealUnit delay={420} className="flex justify-center pt-section-sm">
      <PressableLink
        href="/create"
        interaction={SOLID_CTA}
        className="inline-flex items-center gap-hud-inline rounded-card px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase shadow-glass"
      >
        Issue an invoice
        <span aria-hidden>→</span>
      </PressableLink>
    </RevealUnit>
  </RevealUnit>
);
