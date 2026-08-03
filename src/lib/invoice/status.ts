/**
 * Invoice status, derived rather than stored.
 *
 * "Overdue" is a function of the due date and the clock, so persisting it would
 * mean a row that is wrong from the moment it is written until something
 * rewrites it. Deriving it costs nothing and is never stale.
 */
import type { InvoiceStatus } from "./types";

export interface StatusInput {
  /** Unix seconds. */
  dueAt: number;
  /** Whether settlement has been confirmed. */
  isPaid: boolean;
  /** Unix ms. Injectable so tests are not clock-dependent. */
  now?: number;
}

export function invoiceStatus({ dueAt, isPaid, now = Date.now() }: StatusInput): InvoiceStatus {
  if (isPaid) return "paid";
  // Strictly greater: an invoice is not late on the day it falls due.
  return now > dueAt * 1000 ? "overdue" : "awaiting";
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  awaiting: "Awaiting payment",
  paid: "Paid",
  overdue: "Overdue",
};

/**
 * Tailwind classes per status. Colour is never the only signal — the label
 * always travels with it.
 */
export const STATUS_CLASS: Record<InvoiceStatus, string> = {
  awaiting: "text-caution border-caution/40",
  paid: "text-signal border-signal/40",
  overdue: "text-danger border-danger/40",
};

/** Whole days until due; negative once overdue. */
export function daysUntilDue(dueAt: number, now = Date.now()): number {
  return Math.ceil((dueAt * 1000 - now) / 86_400_000);
}
