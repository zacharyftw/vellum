import type { ReactNode } from "react";

import { RevealHeading, RevealText, RevealUnit } from "@/components/motion/reveal";

const TONE_CLASS = {
  neutral: "border-white/10 text-chalk",
  caution: "border-caution/40 text-caution",
  danger: "border-danger/40 text-danger",
} as const;

export interface StatusPanelProps {
  tone: "neutral" | "caution" | "danger";
  eyebrow: string;
  heading: string;
  body: string;
  children?: ReactNode;
}

/**
 * One panel, one message. Used for every non-`ready` phase of the disclosure
 * flow — no key, no such invoice, a network error, a failed decryption. Each
 * caller supplies its own precise wording; this only carries the shared shape
 * and tone so the four failure modes still read as siblings.
 */
export const StatusPanel = ({ tone, eyebrow, heading, body, children }: StatusPanelProps) => (
  <RevealUnit
    tag="section"
    aria-live="polite"
    className={`rounded-card border bg-surface-raised p-section-sm shadow-glass ${TONE_CLASS[tone]}`}
  >
    <p className="font-hud-mono text-hud-xs tracking-hud uppercase">{eyebrow}</p>
    <RevealHeading
      tag="h2"
      delay={80}
      className="max-w-[36ch] pt-hud-gap font-general text-faq-question leading-title tracking-title text-chalk"
    >
      {heading}
    </RevealHeading>
    <RevealText
      delay={160}
      className="max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
    >
      {body}
    </RevealText>
    {children}
  </RevealUnit>
);
