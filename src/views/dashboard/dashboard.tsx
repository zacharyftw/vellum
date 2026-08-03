"use client";

/**
 * The supplier's invoice dashboard.
 *
 * There is no server-side "show me my invoices" query — see
 * `lib/invoice/vault.ts` for why the server cannot offer one — so this whole
 * view runs in the browser: read the local index, fetch each ciphertext,
 * decrypt it with the key that arrived on its own link, then render. Stays a
 * client leaf at the view level (not just at some inner component) because
 * `localStorage` is the very first thing it needs, on mount, before there is
 * anything to render.
 */
import { useState } from "react";

import { RevealHeading, RevealText, RevealUnit } from "@/components/motion/reveal";

import { DashboardEmpty } from "./empty-state";
import { InvoiceTable } from "./invoice-table";
import { DashboardSummary } from "./summary";
import type { ReadyRow } from "./use-dashboard";
import { useDashboard } from "./use-dashboard";

export const DashboardView = () => {
  const { rows, forget } = useDashboard();
  const readyRows = rows?.filter((row): row is ReadyRow => row.status === "ready") ?? [];
  // A single snapshot for the whole tree: every row's status and "due in N
  // days" caption should agree with each other, not drift because one row
  // happened to render a tick after another.
  const [now] = useState(() => Date.now());

  return (
    <main className="mx-auto w-full max-w-content px-hud-x pt-[calc(var(--spacing-hud-y)+var(--spacing-section))] pb-section max-lg:px-hud-x-sm max-lg:pt-[calc(var(--spacing-hud-y-sm)+var(--spacing-section))]">
      <RevealUnit
        tag="p"
        className="flex items-center gap-hud-inline font-hud-mono text-hud-xs tracking-hud text-signal uppercase"
      >
        <span aria-hidden className="size-dot rounded-full bg-signal shadow-signal" />
        Your invoices
      </RevealUnit>

      <RevealHeading
        tag="h1"
        delay={120}
        className="max-w-[20ch] pt-hud-gap font-general text-hud-title leading-title tracking-title text-shadow-title"
      >
        Dashboard
      </RevealHeading>

      <RevealText
        delay={320}
        className="max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
      >
        This list lives in your browser, not on our server. We store
        ciphertext and nothing that says who it belongs to — so every invoice
        below is fetched and decrypted right here, each time you load this
        page.
      </RevealText>

      {rows === null ? (
        <p className="pt-section-sm font-hud-mono text-hud-xs tracking-hud text-chalk/50 uppercase">
          Reading your local invoice list…
        </p>
      ) : rows.length === 0 ? (
        <div className="pt-section-sm">
          <DashboardEmpty />
        </div>
      ) : (
        <>
          <div className="pt-section-sm">
            <DashboardSummary rows={readyRows} now={now} />
          </div>
          <div className="pt-hud-gap">
            <InvoiceTable rows={rows} onForget={forget} now={now} />
          </div>
        </>
      )}
    </main>
  );
};
