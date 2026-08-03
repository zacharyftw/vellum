/**
 * Form-shaped state for the invoice creation screen, and the one place a
 * draft gets checked before it is allowed to become a real `Invoice`.
 *
 * Kept apart from the components so `parseInvoiceForm` stays a pure function:
 * given the same strings it always returns the same draft or the same
 * errors, which is what makes it safe to call from a submit handler without
 * re-deriving half of it by hand afterwards.
 */
import { validateAndParseAddress } from "starknet";

import type { InvoiceDraft, InvoiceLineItem, InvoiceParty } from "@/lib/invoice/types";
import { parseAmount } from "@/lib/starknet/format";
import type { NetworkKey } from "@/lib/starknet/networks";

export interface PartyFormValues {
  name: string;
  address: string;
  taxId: string;
}

export interface LineItemFormValues {
  /** A React key, not the invoice's own id — unique only among rendered rows. */
  key: string;
  description: string;
  quantity: string;
  amount: string;
}

export interface InvoiceFormValues {
  network: NetworkKey;
  supplier: PartyFormValues;
  buyer: PartyFormValues;
  reference: string;
  /** `<input type="date">` value, e.g. "2026-07-25". */
  issuedAt: string;
  dueAt: string;
  notes: string;
  lineItems: LineItemFormValues[];
}

export interface PartyFormErrors {
  name?: string;
  address?: string;
}

export interface LineItemFormErrors {
  description?: string;
  quantity?: string;
  amount?: string;
}

export interface InvoiceFormErrors {
  supplier?: PartyFormErrors;
  buyer?: PartyFormErrors;
  reference?: string;
  issuedAt?: string;
  dueAt?: string;
  /** A list-level problem, e.g. no rows at all — not tied to any one row. */
  lineItems?: string;
  rows?: Record<string, LineItemFormErrors>;
}

const emptyParty = (): PartyFormValues => ({ name: "", address: "", taxId: "" });

// A React key generator, not a felt — it only has to be unique among rows
// currently on screen, so a counter is simpler than pulling in crypto here.
let lineItemSequence = 0;

export function createEmptyLineItem(): LineItemFormValues {
  lineItemSequence += 1;
  return { key: `row-${lineItemSequence}`, description: "", quantity: "", amount: "" };
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Default due date is issue date + 30 days — the common net-30 term. */
const DEFAULT_TERMS_DAYS = 30;

export function createDefaultFormValues(network: NetworkKey): InvoiceFormValues {
  const today = new Date();
  const due = new Date();
  due.setDate(due.getDate() + DEFAULT_TERMS_DAYS);

  return {
    network,
    supplier: emptyParty(),
    buyer: emptyParty(),
    reference: "",
    issuedAt: toDateInputValue(today),
    dueAt: toDateInputValue(due),
    notes: "",
    lineItems: [createEmptyLineItem()],
  };
}

/**
 * Local midnight for a date-input value, as unix seconds. Local rather than
 * UTC midnight: the picker shows the issuer their own calendar date, and
 * reinterpreting it in UTC could silently shift it to the day before.
 */
function dateInputToUnixSeconds(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.floor(date.getTime() / 1000);
}

function parseParty(values: PartyFormValues): {
  party?: InvoiceParty;
  errors: PartyFormErrors;
} {
  const errors: PartyFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Required.";

  let address = "";
  const rawAddress = values.address.trim();
  if (!rawAddress) {
    errors.address = "Required.";
  } else {
    try {
      // Normalises to the padded form the commitment and the chain expect,
      // and doubles as the validity check — a malformed address throws.
      address = validateAndParseAddress(rawAddress);
    } catch {
      errors.address = "Not a valid Starknet address.";
    }
  }

  if (errors.name || errors.address) return { errors };
  const taxId = values.taxId.trim();
  return { party: { name, address, taxId: taxId || undefined }, errors };
}

export interface ParsedInvoiceForm {
  draft: InvoiceDraft;
  totalRaw: bigint;
}

export type ParseInvoiceFormResult =
  | { ok: true; result: ParsedInvoiceForm }
  | { ok: false; errors: InvoiceFormErrors };

/**
 * Validate and parse a form draft in one pass.
 *
 * The invoice total is not its own field — it is the sum of the line items.
 * A separate total field could disagree with the rows that make it up, and
 * that disagreement would have nowhere honest to go once it is hashed into a
 * commitment. Deriving it here means there is only ever one number.
 */
export function parseInvoiceForm(
  values: InvoiceFormValues,
  decimals: number,
): ParseInvoiceFormResult {
  const errors: InvoiceFormErrors = {};

  const supplierResult = parseParty(values.supplier);
  if (Object.keys(supplierResult.errors).length) errors.supplier = supplierResult.errors;

  const buyerResult = parseParty(values.buyer);
  if (Object.keys(buyerResult.errors).length) errors.buyer = buyerResult.errors;

  const reference = values.reference.trim();
  if (!reference) errors.reference = "Enter a reference or PO number.";

  const issuedAt = dateInputToUnixSeconds(values.issuedAt);
  if (issuedAt === undefined) errors.issuedAt = "Enter a valid date.";

  const dueAt = dateInputToUnixSeconds(values.dueAt);
  if (dueAt === undefined) {
    errors.dueAt = "Enter a valid date.";
  } else if (issuedAt !== undefined && dueAt < issuedAt) {
    errors.dueAt = "Due date must be on or after the issue date.";
  }

  if (values.lineItems.length === 0) {
    errors.lineItems = "Add at least one line item.";
  }

  const rows: Record<string, LineItemFormErrors> = {};
  const lineItems: InvoiceLineItem[] = [];
  let total = 0n;

  for (const row of values.lineItems) {
    const rowErrors: LineItemFormErrors = {};
    const description = row.description.trim();
    if (!description) rowErrors.description = "Required.";
    const quantity = row.quantity.trim();
    if (!quantity) rowErrors.quantity = "Required.";

    let amount = 0n;
    const rawAmount = row.amount.trim();
    if (!rawAmount) {
      rowErrors.amount = "Required.";
    } else {
      try {
        amount = parseAmount(rawAmount, decimals);
        if (amount <= 0n) rowErrors.amount = "Must be greater than zero.";
      } catch (error) {
        rowErrors.amount = error instanceof Error ? error.message : "Not a valid amount.";
      }
    }

    if (Object.keys(rowErrors).length) {
      rows[row.key] = rowErrors;
    } else {
      total += amount;
      lineItems.push({ description, quantity, amountRaw: amount.toString() });
    }
  }
  if (Object.keys(rows).length) errors.rows = rows;

  const hasErrors =
    Object.keys(errors).length > 0 ||
    !supplierResult.party ||
    !buyerResult.party ||
    issuedAt === undefined ||
    dueAt === undefined;

  if (hasErrors) return { ok: false, errors };

  return {
    ok: true,
    result: {
      draft: {
        supplier: supplierResult.party as InvoiceParty,
        buyer: buyerResult.party as InvoiceParty,
        reference,
        amountRaw: total.toString(),
        issuedAt: issuedAt as number,
        dueAt: dueAt as number,
        lineItems,
        notes: values.notes.trim(),
      },
      totalRaw: total,
    },
  };
}
