"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useState } from "react";

import { PressableButton, PressableLink } from "@/components/ui/pressable";
import { SPRING_SOFT } from "@/lib/springs/config";
import { NAV_LINK, QUIET } from "@/lib/springs/interaction";

export interface MobileNavItem {
  label: string;
  href: string;
}

export interface MobileNavProps {
  items: readonly MobileNavItem[];
}

/**
 * The header's nav below 1024px.
 *
 * The desktop pill puts four links and a Contact button on one row; there is no
 * width for that on a phone, so the row collapses to a single toggle and the
 * links move into a panel that drops out from under the bar.
 *
 * The panel is a spring, not a CSS transition (the project has no CSS motion),
 * and it unmounts on `onRest` rather than lingering at `opacity: 0` — otherwise
 * a fixed, blurred panel keeps compositing over the WebGL canvas for nothing.
 * The bars of the toggle animate into an ✕ off the same spring.
 */
export const MobileNav = ({ items }: MobileNavProps) => {
  const [open, setOpen] = useState(false);
  // Kept mounted until the close spring has finished, so the exit is visible.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Escape closes it — a focus-trapping menu the keyboard cannot dismiss is a
  // trap, not a menu.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const panel = useSpring({
    opacity: open ? 1 : 0,
    y: open ? 0 : -12,
    config: SPRING_SOFT,
    onRest: () => {
      if (!open) setMounted(false);
    },
  });

  const topBar = useSpring({
    rotate: open ? 45 : 0,
    y: open ? 5 : 0,
    config: SPRING_SOFT,
  });
  const bottomBar = useSpring({
    rotate: open ? -45 : 0,
    y: open ? -5 : 0,
    config: SPRING_SOFT,
  });

  return (
    <div className="hidden max-lg:block">
      <PressableButton
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((prev) => !prev)}
        interaction={QUIET}
        className="relative flex size-[2.5rem] shrink-0 items-center justify-center"
      >
        <animated.span
          aria-hidden
          className="absolute block h-px w-[1.25rem] bg-white"
          style={{ ...topBar, top: "calc(50% - 5px)" }}
        />
        <animated.span
          aria-hidden
          className="absolute block h-px w-[1.25rem] bg-white"
          style={{ ...bottomBar, top: "calc(50% + 5px)" }}
        />
      </PressableButton>

      {mounted && (
        <animated.nav
          id="mobile-nav"
          aria-label="Main"
          style={panel}
          className="absolute top-[calc(100%+0.5rem)] right-0 left-0 flex flex-col border border-white/10 bg-black/90 p-[1.25rem] backdrop-blur-[8px]"
        >
          {items.map((item) => (
            <PressableLink
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              interaction={NAV_LINK}
              className="py-[0.75rem] font-general text-[1rem] leading-[1.2]"
            >
              {item.label}
            </PressableLink>
          ))}
        </animated.nav>
      )}
    </div>
  );
};
