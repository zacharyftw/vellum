/**
 * The line-item editor.
 *
 * Each row is its own `<fieldset>` so a screen reader announces "Line item 2,
 * Description" rather than three identically-labelled "Description" fields in
 * a row with no way to tell them apart.
 */
import { Field } from "@/components/ui/field";
import { PressableButton } from "@/components/ui/pressable";
import { GHOST, TEXT_LINK } from "@/lib/springs/interaction";
import { formatAmountPretty, parseAmount } from "@/lib/starknet/format";

import {
  createEmptyLineItem,
  type LineItemFormErrors,
  type LineItemFormValues,
} from "./form-state";

export interface LineItemsFieldProps {
  items: LineItemFormValues[];
  rowErrors?: Record<string, LineItemFormErrors>;
  listError?: string;
  tokenSymbol: string;
  decimals: number;
  onChange: (items: LineItemFormValues[]) => void;
}

export const LineItemsField = ({
  items,
  rowErrors,
  listError,
  tokenSymbol,
  decimals,
  onChange,
}: LineItemsFieldProps) => {
  const updateRow = (key: string, patch: Partial<LineItemFormValues>) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const addRow = () => onChange([...items, createEmptyLineItem()]);
  const removeRow = (key: string) => onChange(items.filter((item) => item.key !== key));

  // Best-effort preview only — rows that do not currently parse are skipped
  // rather than blocking the total. `parseInvoiceForm` re-derives the real
  // total at submit time from validated rows, and that copy is the one that
  // ends up in the commitment.
  const runningTotal = items.reduce((sum, item) => {
    try {
      return sum + parseAmount(item.amount.trim() || "0", decimals);
    } catch {
      return sum;
    }
  }, 0n);

  return (
    <div className="rounded-card border border-white/10 bg-surface-raised p-card-x shadow-glass">
      <div className="flex items-baseline justify-between gap-hud-gap">
        <p className="font-hud-mono text-hud-xs tracking-hud uppercase text-signal">
          Line items
        </p>
        <p className="font-hud-mono text-hud-xs tracking-hud text-chalk/50">
          Running total: {formatAmountPretty(runningTotal, decimals)} {tokenSymbol}
        </p>
      </div>
      <p className="pb-card pt-hud-tight font-general text-body-sm leading-body text-chalk/50">
        What this invoice is for. The invoice total is the sum of these rows.
      </p>

      <div className="flex flex-col gap-card">
        {items.map((item, index) => {
          const rowError = rowErrors?.[item.key];
          return (
            <fieldset
              key={item.key}
              className="grid grid-cols-[2fr_1fr_1fr_auto] items-start gap-hud-inline max-lg:grid-cols-1"
            >
              <legend className="sr-only">Line item {index + 1}</legend>
              <Field
                label="Description"
                value={item.description}
                onChange={(event) => updateRow(item.key, { description: event.target.value })}
                error={rowError?.description}
                placeholder="Consulting services, March"
              />
              <Field
                label="Quantity"
                value={item.quantity}
                onChange={(event) => updateRow(item.key, { quantity: event.target.value })}
                error={rowError?.quantity}
                placeholder="40 hours"
              />
              <Field
                label="Amount"
                type="text"
                inputMode="decimal"
                suffix={tokenSymbol}
                value={item.amount}
                onChange={(event) => updateRow(item.key, { amount: event.target.value })}
                error={rowError?.amount}
                placeholder="0.00"
              />
              <div className="flex h-full items-end pb-hud-tight max-lg:justify-end">
                <PressableButton
                  type="button"
                  interaction={TEXT_LINK}
                  onClick={() => removeRow(item.key)}
                  disabled={items.length <= 1}
                  aria-label={`Remove line item ${index + 1}`}
                  className="font-hud-mono text-hud-md leading-none text-chalk/50 disabled:opacity-30"
                >
                  ×
                </PressableButton>
              </div>
            </fieldset>
          );
        })}
      </div>

      {listError ? (
        <p role="alert" className="pt-card font-hud-mono text-hud-xs text-danger">
          {listError}
        </p>
      ) : null}

      <PressableButton
        type="button"
        interaction={GHOST}
        onClick={addRow}
        className="mt-card inline-flex items-center gap-hud-inline rounded-card border px-cta-x py-hud-tight font-hud-mono text-hud-xs tracking-hud uppercase backdrop-blur-glass"
      >
        + Add line item
      </PressableButton>
    </div>
  );
};
