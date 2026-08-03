"use client";

/**
 * Form primitives.
 *
 * Every control is a real labelled `<input>` / `<textarea>` with the label tied
 * by `htmlFor`, and errors are wired through `aria-describedby` so a screen
 * reader announces the message with the field rather than stranding it.
 *
 * Money fields use `inputMode="decimal"` and `type="text"`, never
 * `type="number"`. A number input silently rounds anything past float
 * precision, scrolls the value on a stray wheel gesture, and disagrees between
 * locales about the decimal separator — none of which are acceptable on a field
 * that is hashed into a commitment and settled on-chain.
 */
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";

const CONTROL_BASE =
  "w-full rounded-card border bg-void/40 px-card-x py-card-y font-general text-body-sm text-chalk placeholder:text-chalk/30 outline-none focus-visible:border-signal/60 focus-visible:ring-2 focus-visible:ring-signal/30";

const LABEL_BASE =
  "block font-hud-mono text-hud-xs tracking-hud uppercase text-chalk/60";

interface FieldShellProps {
  label: string;
  /** Shown under the control when set. Takes the field into its error state. */
  error?: string;
  /** Quiet guidance under the label. */
  hint?: string;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}

const FieldShell = ({ label, error, hint, children }: FieldShellProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : undefined, error ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-hud-tight">
      <label htmlFor={id} className={LABEL_BASE}>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="font-general text-hud-sm text-chalk/40">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy })}
      {error ? (
        <p id={errorId} role="alert" className="font-hud-mono text-hud-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  label: string;
  error?: string;
  hint?: string;
  /** Trailing unit or token symbol, e.g. "STRK". */
  suffix?: string;
}

export const Field = ({ label, error, hint, suffix, ...props }: FieldProps) => (
  <FieldShell label={label} error={error} hint={hint}>
    {({ id, describedBy }) => (
      <div className="relative">
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`${CONTROL_BASE} ${error ? "border-danger/60" : "border-white/10"} ${suffix ? "pr-[4.5rem]" : ""}`}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-card-x flex items-center font-hud-mono text-hud-xs tracking-hud text-chalk/40">
            {suffix}
          </span>
        ) : null}
      </div>
    )}
  </FieldShell>
);

export interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextAreaField = ({
  label,
  error,
  hint,
  rows = 3,
  ...props
}: TextAreaFieldProps) => (
  <FieldShell label={label} error={error} hint={hint}>
    {({ id, describedBy }) => (
      <textarea
        id={id}
        rows={rows}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`${CONTROL_BASE} resize-y ${error ? "border-danger/60" : "border-white/10"}`}
        {...props}
      />
    )}
  </FieldShell>
);

/** A titled group of fields, as one glass panel. */
export const FieldGroup = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <fieldset className="rounded-card border border-white/10 bg-surface-raised p-card-x shadow-glass">
    <legend className="px-hud-tight font-hud-mono text-hud-xs tracking-hud uppercase text-signal">
      {title}
    </legend>
    {description ? (
      <p className="pb-card font-general text-body-sm leading-body text-chalk/50">
        {description}
      </p>
    ) : null}
    <div className="flex flex-col gap-card pt-hud-tight">{children}</div>
  </fieldset>
);
