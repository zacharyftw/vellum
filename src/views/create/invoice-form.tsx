/**
 * The invoice draft form itself — every field the issuer fills in, before
 * anything is generated, hashed, or encrypted.
 *
 * Pure presentation over `InvoiceFormValues`/`InvoiceFormErrors`: this
 * component never touches crypto or the network, so it can be read (and
 * tested) without either.
 */
import type { Dispatch, FormEvent, SetStateAction } from "react";

import { Field, FieldGroup, TextAreaField } from "@/components/ui/field";
import { PressableButton } from "@/components/ui/pressable";
import { SOLID_CTA } from "@/lib/springs/interaction";
import { NETWORKS, type NetworkKey } from "@/lib/starknet/networks";

import {
  type InvoiceFormErrors,
  type InvoiceFormValues,
  type PartyFormErrors,
  type PartyFormValues,
} from "./form-state";
import { LineItemsField } from "./line-items-field";

export interface InvoiceFormProps {
  values: InvoiceFormValues;
  errors: InvoiceFormErrors;
  submitError?: string;
  isSubmitting: boolean;
  onChange: Dispatch<SetStateAction<InvoiceFormValues>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const InvoiceForm = ({
  values,
  errors,
  submitError,
  isSubmitting,
  onChange,
  onSubmit,
}: InvoiceFormProps) => {
  const tokenConfig = NETWORKS[values.network];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-section-sm pt-section-sm">
      <div className="grid grid-cols-2 gap-hud-gap max-lg:grid-cols-1">
        <PartyFieldset
          title="Your details"
          description="The supplier issuing this invoice."
          values={values.supplier}
          errors={errors.supplier}
          onChange={(patch) =>
            onChange((prev) => ({ ...prev, supplier: { ...prev.supplier, ...patch } }))
          }
        />
        <PartyFieldset
          title="Customer details"
          description="Who this invoice is billed to."
          values={values.buyer}
          errors={errors.buyer}
          onChange={(patch) =>
            onChange((prev) => ({ ...prev, buyer: { ...prev.buyer, ...patch } }))
          }
        />
      </div>

      <FieldGroup title="Invoice details">
        <NetworkToggle
          value={values.network}
          onChange={(network) => onChange((prev) => ({ ...prev, network }))}
        />
        <div className="grid grid-cols-3 gap-hud-gap max-lg:grid-cols-1">
          <Field
            label="Reference"
            hint="Your invoice or PO number."
            value={values.reference}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, reference: event.target.value }))
            }
            error={errors.reference}
            placeholder="INV-2026-014"
          />
          <Field
            label="Issued"
            type="date"
            value={values.issuedAt}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, issuedAt: event.target.value }))
            }
            error={errors.issuedAt}
          />
          <Field
            label="Due"
            type="date"
            value={values.dueAt}
            onChange={(event) => onChange((prev) => ({ ...prev, dueAt: event.target.value }))}
            error={errors.dueAt}
          />
        </div>
      </FieldGroup>

      <LineItemsField
        items={values.lineItems}
        rowErrors={errors.rows}
        listError={errors.lineItems}
        tokenSymbol={tokenConfig.tokenSymbol}
        decimals={tokenConfig.tokenDecimals}
        onChange={(lineItems) => onChange((prev) => ({ ...prev, lineItems }))}
      />

      <TextAreaField
        label="Notes"
        hint="Optional — your customer will see this."
        rows={3}
        value={values.notes}
        onChange={(event) => onChange((prev) => ({ ...prev, notes: event.target.value }))}
        placeholder="Payment terms, delivery details, anything else worth saying."
      />

      {submitError ? (
        <p
          role="alert"
          className="rounded-card border border-danger/40 bg-danger/10 px-card-x py-card-y font-general text-body-sm leading-body text-danger"
        >
          {submitError}
        </p>
      ) : null}

      <PressableButton
        type="submit"
        interaction={SOLID_CTA}
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-hud-inline self-start rounded-card px-cta-x py-cta-y font-hud-mono text-hud-sm tracking-hud uppercase shadow-glass disabled:opacity-60"
      >
        {isSubmitting ? "Encrypting…" : "Issue invoice"}
        <span aria-hidden>{isSubmitting ? "" : "→"}</span>
      </PressableButton>
    </form>
  );
};

interface PartyFieldsetProps {
  title: string;
  description: string;
  values: PartyFormValues;
  errors?: PartyFormErrors;
  onChange: (patch: Partial<PartyFormValues>) => void;
}

const PartyFieldset = ({ title, description, values, errors, onChange }: PartyFieldsetProps) => (
  <FieldGroup title={title} description={description}>
    <Field
      label="Name"
      value={values.name}
      onChange={(event) => onChange({ name: event.target.value })}
      error={errors?.name}
      placeholder="Acme Bolts GmbH"
    />
    <Field
      label="Starknet address"
      value={values.address}
      onChange={(event) => onChange({ address: event.target.value })}
      error={errors?.address}
      placeholder="0x0…"
      spellCheck={false}
      autoComplete="off"
    />
    <Field
      label="Tax ID"
      value={values.taxId}
      onChange={(event) => onChange({ taxId: event.target.value })}
      hint="Optional — for the auditor's benefit."
      placeholder="DE123456789"
    />
  </FieldGroup>
);

const NetworkToggle = ({
  value,
  onChange,
}: {
  value: NetworkKey;
  onChange: (network: NetworkKey) => void;
}) => (
  <div className="flex flex-col gap-hud-tight">
    <span className="block font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/60">
      Network
    </span>
    <div role="radiogroup" aria-label="Network" className="flex gap-hud-inline">
      {Object.values(NETWORKS).map((network) => (
        <label
          key={network.key}
          className={`flex cursor-pointer items-center gap-hud-inline rounded-card border px-card-x py-hud-tight font-hud-mono text-hud-xs tracking-hud uppercase ${
            value === network.key
              ? "border-signal/60 text-signal"
              : "border-white/10 text-chalk/60"
          }`}
        >
          <input
            type="radio"
            name="network"
            value={network.key}
            checked={value === network.key}
            onChange={() => onChange(network.key)}
            className="sr-only"
          />
          {network.label}
        </label>
      ))}
    </div>
  </div>
);
