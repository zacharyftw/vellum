"use client";

/**
 * A one-shot mount animation for content that appears after an async step
 * (fetch, decrypt) rather than on scroll — `Inview` in `components/motion/reveal`
 * only fires on intersection, which never happens for content that is already
 * in the viewport when it swaps in.
 */
import { animated, useSpring } from "@react-spring/web";
import type { ReactNode } from "react";

const FADE_CONFIG = { tension: 210, friction: 26 };

export const FadeIn = ({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  const style = useSpring({
    from: { opacity: 0, y: 0.75 },
    to: { opacity: 1, y: 0 },
    delay,
    config: FADE_CONFIG,
  });

  return (
    <animated.div
      style={{
        opacity: style.opacity,
        transform: style.y.to((y) => `translateY(${y}rem)`),
      }}
      className={className}
    >
      {children}
    </animated.div>
  );
};

/** A breathing status dot for states with no determinate progress. */
export const PulseDot = ({ className = "" }: { className?: string }) => {
  const style = useSpring({
    loop: { reverse: true },
    from: { opacity: 0.3 },
    to: { opacity: 1 },
    config: { tension: 60, friction: 14 },
  });

  return (
    <animated.span
      aria-hidden
      style={style}
      className={`inline-block size-dot rounded-full bg-signal shadow-signal ${className}`}
    />
  );
};
