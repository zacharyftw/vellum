import { STATUS_CLASS, STATUS_LABEL } from "@/lib/invoice/status";
import type { InvoiceStatus } from "@/lib/invoice/types";

/**
 * The status badge.
 *
 * Carries its label as text, not just a colour — a red dot alone is invisible
 * to a colour-blind reader and to a screen reader alike.
 */
export const StatusPill = ({
  status,
  className = "",
}: {
  status: InvoiceStatus;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center gap-hud-tight rounded-card border px-hud-inline py-hud-tight font-hud-mono text-hud-xs tracking-hud uppercase ${STATUS_CLASS[status]} ${className}`}
  >
    <span aria-hidden className="size-dot rounded-full bg-current" />
    {STATUS_LABEL[status]}
  </span>
);
