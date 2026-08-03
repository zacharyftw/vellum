"use client";

import type { ReactNode } from "react";

import { PressableButton } from "@/components/ui/pressable";
import { GHOST_INVERSE, SOLID_INVERSE } from "@/lib/springs/interaction";

/**
 * Cookie-scoped button primitive. Two variants matching the project's
 * white/dark surfaces — replaces the external `SimpleButton` the component
 * shipped with.
 *
 * Hover and press are springs (`PressableButton`), like every other control on the
 * site. They used to be bare `hover:` utilities, which snapped — legal under the
 * no-CSS-transitions rule, but the only controls on the page that did.
 */
export interface CookieButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

const base = "rounded-lg px-4 py-2 text-sm font-medium leading-none";

// Surface and ink colours come from the spring, so these carry layout only.
const variants: Record<NonNullable<CookieButtonProps["variant"]>, string> = {
  primary: "",
  secondary: "border bg-transparent text-foreground",
};

const interactions = {
  primary: SOLID_INVERSE,
  secondary: GHOST_INVERSE,
} as const;

export const CookieButton = ({
  children,
  onClick,
  variant = "primary",
}: CookieButtonProps) => (
  <PressableButton
    type="button"
    onClick={onClick}
    interaction={interactions[variant]}
    className={`${base} ${variants[variant]}`}
  >
    {children}
  </PressableButton>
);
