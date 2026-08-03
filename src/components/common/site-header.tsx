import { PressableLink } from "@/components/ui/pressable";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { NAV_LINK, QUIET } from "@/lib/springs/interaction";

import { MobileNav } from "./mobile-nav";

/**
 * Fixed, site-wide header.
 *
 * Sized in `rem` rather than the `vw` ladder the marketing artboard uses: the
 * same bar sits above the invoice form and the dashboard, and chrome that
 * shrinks with the viewport turns a wallet address into unreadable type on a
 * laptop. The adaptive root font-size still scales it — just proportionally to
 * the design, not to the artboard.
 *
 * Stays a Server Component; the wallet control is the only client leaf.
 */
const NAV = [
  { label: "Why", href: "/#why" },
  { label: "How", href: "/#how" },
  { label: "Invoices", href: "/dashboard" },
] as const;

export const SiteHeader = () => {
  return (
    <header className="pointer-events-auto fixed top-hud-y left-1/2 z-50 w-[calc(100%-2*var(--spacing-hud-x))] max-w-content -translate-x-1/2 rounded-card border border-white/10 bg-void/80 backdrop-blur-glass max-lg:top-hud-y-sm max-lg:w-[calc(100%-2*var(--spacing-hud-x-sm))]">
      <div className="flex items-center justify-between gap-hud-gap py-card-y pr-card-y pl-card-x">
        <PressableLink
          href="/"
          aria-label="Vellum — home"
          interaction={QUIET}
          className="flex shrink-0 items-center gap-hud-inline font-general text-wordmark leading-none tracking-brand uppercase"
        >
          <span aria-hidden className="size-dot rounded-full bg-signal shadow-signal" />
          Vellum
        </PressableLink>

        <nav
          aria-label="Main"
          className="flex items-center gap-hud-gap font-hud-mono text-hud-xs tracking-hud whitespace-nowrap uppercase max-lg:hidden"
        >
          {NAV.map((item) => (
            <PressableLink
              key={item.label}
              href={item.href}
              interaction={NAV_LINK}
            >
              {item.label}
            </PressableLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-hud-inline max-lg:hidden">
          <ConnectWallet variant="pill" />
        </div>

        <MobileNav items={NAV} />
      </div>
    </header>
  );
};
