/**
 * Date formatting for the disclosure document.
 *
 * A formal document reads oddly with a relative time ("3 days ago"), which
 * also drifts as the reader's clock differs from the one the invoice was
 * written on. Absolute dates only.
 */

/** Unix seconds → "25 Jul 2026". */
export function formatDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(unixSeconds * 1000),
  );
}

/** ISO timestamp → "25 Jul 2026, 14:03". */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
