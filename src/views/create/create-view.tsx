"use client";

/**
 * The invoice creation screen.
 *
 * This view is the whole trust boundary: everything the buyer will ever see
 * is built, hashed, and sealed here, in the browser, before a single byte
 * reaches our server. The submit handler follows one order and does not
 * deviate from it — commit, encrypt, *then* send — so nothing partial can
 * ever end up on the server without also being unreadable.
 *
 * The whole tree is a client component rather than a Server Component shell
 * around a client leaf: the form is the entire page, so there is no server-
 * renderable part left once you subtract it.
 */
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { RevealHeading, RevealText, RevealUnit } from "@/components/motion/reveal";
import { generateInvoiceId, generateSalt, invoiceCommitment } from "@/lib/invoice/commitment";
import { createInvoice, InvoiceApiError } from "@/lib/invoice/api";
import {
  buildInvoiceLink,
  encryptInvoice,
  exportInvoiceKey,
  generateInvoiceKey,
} from "@/lib/invoice/crypto";
import type { Invoice } from "@/lib/invoice/types";
import { rememberInvoice } from "@/lib/invoice/vault";
import { DEFAULT_NETWORK, NETWORKS } from "@/lib/starknet/networks";
import { useWalletStore } from "@/lib/starknet/wallet-store";

import { createDefaultFormValues, parseInvoiceForm } from "./form-state";
import type { InvoiceFormErrors, InvoiceFormValues } from "./form-state";
import { InvoiceForm } from "./invoice-form";
import { InvoiceReceipt, type IssuedInvoice } from "./invoice-receipt";

export const CreateView = () => {
  const walletAddress = useWalletStore((state) => state.address);
  const walletNetworkKey = useWalletStore((state) => state.network?.key);

  const [values, setValues] = useState<InvoiceFormValues>(() =>
    createDefaultFormValues(walletNetworkKey ?? DEFAULT_NETWORK),
  );
  const [errors, setErrors] = useState<InvoiceFormErrors>({});
  const [submitError, setSubmitError] = useState<string>();
  const [isSubmitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<IssuedInvoice>();

  // A wallet connected after the form was already open is still the obvious
  // supplier address — but only ever fills a field the issuer has not typed
  // into, so it can never clobber something they entered by hand.
  useEffect(() => {
    if (!walletAddress) return;
    setValues((prev) =>
      prev.supplier.address ? prev : { ...prev, supplier: { ...prev.supplier, address: walletAddress } },
    );
  }, [walletAddress]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const tokenConfig = NETWORKS[values.network];
    const parsed = parseInvoiceForm(values, tokenConfig.tokenDecimals);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setSubmitError(undefined);
      return;
    }

    setErrors({});
    setSubmitError(undefined);
    setSubmitting(true);

    try {
      const invoice: Invoice = {
        ...parsed.result.draft,
        id: generateInvoiceId(),
        salt: generateSalt(),
        network: values.network,
        tokenAddress: tokenConfig.tokenAddress,
        tokenDecimals: tokenConfig.tokenDecimals,
        tokenSymbol: tokenConfig.tokenSymbol,
      };

      // Commit, then encrypt, then send — the order that guarantees the server
      // only ever receives an invoice that is both sealed and anchorable.
      const commitment = await invoiceCommitment(invoice);
      const key = await generateInvoiceKey();
      const { ciphertext, iv } = await encryptInvoice(invoice, key);

      await createInvoice({
        id: invoice.id,
        ciphertext,
        iv,
        commitment,
        network: invoice.network,
      });

      const encodedKey = await exportInvoiceKey(key);
      const link = buildInvoiceLink(window.location.origin, invoice.id, encodedKey);
      rememberInvoice({ id: invoice.id, key: encodedKey, role: "issuer", network: invoice.network });

      setIssued({ invoice, link });
    } catch (error) {
      setSubmitError(
        error instanceof InvoiceApiError
          ? error.message
          : "Something went wrong issuing the invoice. Nothing was sent — try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAnother = () => {
    setIssued(undefined);
    setValues(createDefaultFormValues(values.network));
    setErrors({});
    setSubmitError(undefined);
  };

  return (
    <main className="mx-auto w-full max-w-content px-hud-x pt-[10rem] pb-section max-lg:px-hud-x-sm max-lg:pt-[8rem]">
      {issued ? (
        <InvoiceReceipt issued={issued} onCreateAnother={handleCreateAnother} />
      ) : (
        <>
          <Intro />
          <InvoiceForm
            values={values}
            errors={errors}
            submitError={submitError}
            isSubmitting={isSubmitting}
            onChange={setValues}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </main>
  );
};

const Intro = () => (
  <div className="max-w-content-copy">
    <RevealUnit
      tag="p"
      className="flex items-center gap-hud-inline font-hud-mono text-hud-xs tracking-hud uppercase text-signal"
    >
      <span aria-hidden className="size-dot rounded-full bg-signal shadow-signal" />
      New invoice
    </RevealUnit>
    <RevealHeading
      tag="h1"
      delay={120}
      className="pt-hud-gap font-general text-outro-title leading-title tracking-title text-shadow-title"
    >
      Bill privately.
    </RevealHeading>
    <RevealText
      delay={280}
      className="max-w-content-copy pt-hud-gap font-general text-body leading-body text-chalk/70"
    >
      This is encrypted in your browser before anything leaves it. We only
      ever store the ciphertext — the decryption key goes in the link you
      send your customer, and nowhere else.
    </RevealText>
  </div>
);
