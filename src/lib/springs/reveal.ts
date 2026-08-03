import { easings } from "@react-spring/web";

/**
 * Shared reveal presets for the section copy.
 *
 * **Headings** and **body copy** animate per-letter / per-word with
 * `spring-text-engine`; **non-text units** (buttons, labels, lists) and the
 * **photo** use the `Inview` spring wrapper.
 *
 * ## Keeping the layout put
 * `TextEngine` lays its container out as `display:flex; flex-wrap:wrap` with a
 * `column-gap` between words, AND hardcodes `position: relative` on it. Three
 * things must be handled at every call site or the copy shifts:
 * 1. **Positioning** — the inline `position: relative` beats a Tailwind `absolute`
 *    class, so an absolutely-positioned engine falls back into flow (left-anchored
 *    copy survives by coincidence; `right-0` / centered copy breaks). Pass
 *    `style={{ position: "absolute" }}` — the engine spreads `...style` last, so it
 *    wins. (In-flow copy like the FAQ title needs nothing.)
 * 2. **Alignment** — flex ignores `text-align`. Centered copy needs
 *    `justify-center`, right-aligned copy needs `justify-end` (left is the flex
 *    default). Keep the `text-*` class too, for the hidden SEO copy.
 * 3. **Word spacing** — `columnGap` (below) replaces the natural space; ~0.25em
 *    matches the font's space glyph. Tune here if spacing looks off.
 *
 * Letters carry **no transform** (opacity + blur only), and words translate via
 * the inner span — never the container — so neither disturbs the box or a
 * `-translate-x-1/2` centering. Spread a preset into `<TextEngine>` / `<Inview>`;
 * set `mode`, `enabled`, `immediateOut`, `delayIn`, `tag`, `className` per site.
 */

const SOFT = { duration: 1000, easing: easings.easeOutQuint };
const SOFT_SLOW = { duration: 1200, easing: easings.easeOutQuint };

/** Heading — per-letter, left→right, blur + opacity (no transform → box stays). */
export const LETTER_REVEAL = {
  letterIn: { opacity: 1, filter: "blur(0px)" },
  letterOut: { opacity: 0, filter: "blur(12px)" },
  letterStagger: 26,
  letterConfig: SOFT,
  columnGap: 0.25,
} as const;

/** Body / sub-head — per-word, bottom→up, blur + opacity. */
export const WORD_REVEAL = {
  wordIn: { y: 0, opacity: 1, filter: "blur(0px)" },
  wordOut: { y: 16, opacity: 0, filter: "blur(8px)" },
  wordStagger: 42,
  wordConfig: SOFT_SLOW,
  columnGap: 0.25,
} as const;

/** Non-text unit (button, tag row, label) — fade + blur + rise, via `Inview`. */
export const UNIT_REVEAL = {
  from: { opacity: 0, y: 20, filter: "blur(10px)" },
  to: { opacity: 1, y: 0, filter: "blur(0px)" },
  config: SOFT,
} as const;

/** Image mask — reveals top→bottom (the clip opens downward), via `Inview`. */
export const MASK_REVEAL = {
  from: { clipPath: "inset(0 0 100% 0)" },
  to: { clipPath: "inset(0 0 0% 0)" },
  config: SOFT_SLOW,
} as const;

/**
 * White-card reveal, via `Inview`. The card scales up, unblurs, and tilts on the
 * horizontal axis (`rotateX`) as it settles — needs `perspective` + `origin-bottom`
 * on the wrapper for the tilt to read in 3D. `scale`/`rotateX` are react-spring
 * transform shorthands, so they compose on the animated element's `transform`.
 */
export const CARD_REVEAL = {
  from: { opacity: 0, scale: 0.94, rotateX: 12, filter: "blur(14px)" },
  to: { opacity: 1, scale: 1, rotateX: 0, filter: "blur(0px)" },
  config: SOFT_SLOW,
} as const;
