"use client";

/**
 * Client leaves for scroll reveals.
 *
 * `TextEngine` and `Inview` are both client components, and marking a whole
 * page `"use client"` to use them would drag the entire view across the
 * boundary. These three wrappers are the only client code the marketing pages
 * need; the views themselves stay Server Components.
 *
 * Everything animates `mode="once"`. Copy that re-plays every time it scrolls
 * back into view is a screensaver — the reader has already read it.
 */
import type { ReactNode } from "react";
import TextEngine from "spring-text-engine";

import { Inview } from "@/components/animation/springs/in-view";
import {
  CARD_REVEAL,
  LETTER_REVEAL,
  UNIT_REVEAL,
  WORD_REVEAL,
} from "@/lib/springs/reveal";
import type { Tags } from "@/types/springs";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Milliseconds to hold before starting. Use to stagger a group. */
  delay?: number;
}

/**
 * A heading, revealed letter by letter.
 *
 * Letters carry opacity and blur but no transform, so the box never moves and
 * the surrounding layout does not reflow mid-animation.
 */
export const RevealHeading = ({
  children,
  className = "",
  delay = 0,
  tag = "h2",
}: RevealProps & { tag?: "h1" | "h2" | "h3" }) => (
  <TextEngine
    tag={tag}
    mode="once"
    delayIn={delay}
    className={className}
    {...LETTER_REVEAL}
  >
    {children}
  </TextEngine>
);

/** Body copy, revealed word by word from below. */
export const RevealText = ({
  children,
  className = "",
  delay = 0,
  tag = "p",
}: RevealProps & { tag?: "p" | "span" }) => (
  <TextEngine
    tag={tag}
    mode="once"
    delayIn={delay}
    className={className}
    {...WORD_REVEAL}
  >
    {children}
  </TextEngine>
);

/**
 * Anything that is not text — a button row, a label, an image.
 *
 * `TextEngine` would split these into words and animate the pieces; `Inview`
 * moves the whole element as one unit.
 */
export const RevealUnit = ({
  children,
  className = "",
  delay = 0,
  tag = "div",
}: RevealProps & { tag?: Tags }) => (
  <Inview
    tag={tag}
    mode="once"
    delayIn={delay}
    className={className}
    {...UNIT_REVEAL}
  >
    {children}
  </Inview>
);

/** A card — rises, unblurs, and settles out of a slight tilt. */
export const RevealCard = ({
  children,
  className = "",
  delay = 0,
  tag = "li",
}: RevealProps & { tag?: Tags }) => (
  <Inview
    tag={tag}
    mode="once"
    delayIn={delay}
    className={className}
    {...CARD_REVEAL}
  >
    {children}
  </Inview>
);
