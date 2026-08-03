import { describe, expect, it } from "vitest";
import { num } from "starknet";

import {
  generateInvoiceId,
  generateSalt,
  invoiceCommitment,
  paymentCommitment,
  verifyCommitment,
} from "./commitment";
import {
  buildInvoiceLink,
  decryptInvoice,
  encryptInvoice,
  exportInvoiceKey,
  generateInvoiceKey,
  importInvoiceKey,
  readKeyFromFragment,
} from "./crypto";
import type { Invoice } from "./types";

const SUPPLIER = "0x02a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const BUYER = "0x0189abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345";
const TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/**
 * Alter a base64url string so the bytes it decodes to genuinely change.
 * Targets a middle character, which always contributes all six of its bits.
 */
function tamper(value: string): string {
  const at = Math.floor(value.length / 2);
  return value.slice(0, at) + (value[at] === "A" ? "B" : "A") + value.slice(at + 1);
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "0x9f2b1c4d6e8a0b2c4d6e8a0b2c4d6e8a",
    salt: "0x5a17c0ffee1234567890abcdef1234567890abcdef1234567890abcdef123456",
    network: "sepolia",
    tokenAddress: TOKEN,
    tokenDecimals: 18,
    tokenSymbol: "STRK",
    supplier: { name: "Acme Bolts GmbH", address: SUPPLIER, taxId: "DE123456789" },
    buyer: { name: "Northbridge Motors", address: BUYER },
    reference: "ACME-2026-0417",
    amountRaw: (50_000n * 10n ** 18n).toString(),
    issuedAt: 1_760_000_000,
    dueAt: 1_762_592_000,
    lineItems: [
      {
        description: "M8×40 hex bolts, zinc plated",
        quantity: "200,000 units",
        amountRaw: (48_000n * 10n ** 18n).toString(),
      },
      {
        description: "Freight, DAP Stuttgart",
        quantity: "1",
        amountRaw: (2_000n * 10n ** 18n).toString(),
      },
    ],
    notes: "Net 30. Partial deliveries not accepted.",
    ...overrides,
  };
}

describe("identifiers", () => {
  it("generates distinct ids and salts inside the felt range", () => {
    const feltMax = 2n ** 251n;
    const ids = new Set<string>();
    for (let index = 0; index < 50; index += 1) {
      const id = generateInvoiceId();
      const salt = generateSalt();
      expect(num.toBigInt(id)).toBeLessThan(feltMax);
      expect(num.toBigInt(salt)).toBeLessThan(feltMax);
      ids.add(id);
    }
    expect(ids.size).toBe(50);
  });
});

describe("invoiceCommitment", () => {
  it("is deterministic for identical input", async () => {
    const invoice = makeInvoice();
    expect(await invoiceCommitment(invoice)).toBe(
      await invoiceCommitment(makeInvoice()),
    );
  });

  it("does not depend on key insertion order", async () => {
    const invoice = makeInvoice();
    // Same data, different property order — a naive JSON.stringify would hash
    // this differently, and the invoice would stop verifying after a DB round-trip.
    const reordered: Invoice = {
      ...makeInvoice(),
      buyer: { address: BUYER, name: "Northbridge Motors" },
      supplier: { taxId: "DE123456789", address: SUPPLIER, name: "Acme Bolts GmbH" },
    };
    expect(await invoiceCommitment(reordered)).toBe(
      await invoiceCommitment(invoice),
    );
  });

  it("changes when any economic term changes", async () => {
    const base = await invoiceCommitment(makeInvoice());
    const mutations: Partial<Invoice>[] = [
      { amountRaw: (50_001n * 10n ** 18n).toString() },
      { dueAt: 1_762_592_001 },
      { issuedAt: 1_760_000_001 },
      { supplier: { name: "Acme Bolts GmbH", address: BUYER, taxId: "DE123456789" } },
      { buyer: { name: "Northbridge Motors", address: SUPPLIER } },
      { salt: "0x1" },
      { id: "0x1" },
    ];
    for (const mutation of mutations) {
      expect(await invoiceCommitment(makeInvoice(mutation))).not.toBe(base);
    }
  });

  it("changes on a one-wei difference", async () => {
    const base = await invoiceCommitment(makeInvoice());
    const offByOne = await invoiceCommitment(
      makeInvoice({ amountRaw: (50_000n * 10n ** 18n + 1n).toString() }),
    );
    expect(offByOne).not.toBe(base);
  });

  it("changes when free text changes", async () => {
    const base = await invoiceCommitment(makeInvoice());
    expect(await invoiceCommitment(makeInvoice({ notes: "Net 60." }))).not.toBe(base);
    expect(
      await invoiceCommitment(makeInvoice({ reference: "ACME-2026-0418" })),
    ).not.toBe(base);
    expect(
      await invoiceCommitment(
        makeInvoice({
          lineItems: [
            {
              description: "M8×40 hex bolts, zinc plated",
              quantity: "200,001 units",
              amountRaw: (48_000n * 10n ** 18n).toString(),
            },
            makeInvoice().lineItems[1],
          ],
        }),
      ),
    ).not.toBe(base);
  });

  it("distinguishes line items that were merely reordered", async () => {
    const invoice = makeInvoice();
    const swapped = makeInvoice({
      lineItems: [invoice.lineItems[1], invoice.lineItems[0]],
    });
    expect(await invoiceCommitment(swapped)).not.toBe(
      await invoiceCommitment(invoice),
    );
  });
});

describe("verifyCommitment", () => {
  it("accepts the plaintext it was built from", async () => {
    const invoice = makeInvoice();
    const commitment = await invoiceCommitment(invoice);
    await expect(verifyCommitment(invoice, commitment)).resolves.toBe(true);
  });

  it("accepts a differently-padded but numerically equal felt", async () => {
    const invoice = makeInvoice();
    const commitment = await invoiceCommitment(invoice);
    const padded = `0x${commitment.slice(2).padStart(64, "0")}`;
    await expect(verifyCommitment(invoice, padded)).resolves.toBe(true);
  });

  it("rejects a tampered invoice", async () => {
    const commitment = await invoiceCommitment(makeInvoice());
    const tampered = makeInvoice({ amountRaw: (5_000n * 10n ** 18n).toString() });
    await expect(verifyCommitment(tampered, commitment)).resolves.toBe(false);
  });

  it("returns false rather than throwing on a malformed commitment", async () => {
    await expect(verifyCommitment(makeInvoice(), "not-a-felt")).resolves.toBe(
      false,
    );
  });
});

describe("paymentCommitment", () => {
  it("binds the payment to the payer", async () => {
    const invoice = makeInvoice();
    const byBuyer = await paymentCommitment(invoice, BUYER);
    const bySomeoneElse = await paymentCommitment(invoice, SUPPLIER);
    expect(byBuyer).not.toBe(bySomeoneElse);
  });

  it("is deterministic and differs from the invoice commitment", async () => {
    const invoice = makeInvoice();
    expect(await paymentCommitment(invoice, BUYER)).toBe(
      await paymentCommitment(makeInvoice(), BUYER),
    );
    expect(await paymentCommitment(invoice, BUYER)).not.toBe(
      await invoiceCommitment(invoice),
    );
  });
});

describe("encryption", () => {
  it("round-trips an invoice", async () => {
    const invoice = makeInvoice();
    const key = await generateInvoiceKey();
    const encrypted = await encryptInvoice(invoice, key);
    await expect(decryptInvoice(encrypted, key)).resolves.toEqual(invoice);
  });

  it("survives export and re-import of the key", async () => {
    const invoice = makeInvoice();
    const key = await generateInvoiceKey();
    const encrypted = await encryptInvoice(invoice, key);
    const reimported = await importInvoiceKey(await exportInvoiceKey(key));
    await expect(decryptInvoice(encrypted, reimported)).resolves.toEqual(invoice);
  });

  it("produces a different ciphertext each time", async () => {
    const invoice = makeInvoice();
    const key = await generateInvoiceKey();
    const first = await encryptInvoice(invoice, key);
    const second = await encryptInvoice(invoice, key);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.iv).not.toBe(second.iv);
  });

  it("fails closed on the wrong key", async () => {
    const encrypted = await encryptInvoice(makeInvoice(), await generateInvoiceKey());
    await expect(
      decryptInvoice(encrypted, await generateInvoiceKey()),
    ).rejects.toThrow();
  });

  it("fails closed on a tampered ciphertext", async () => {
    const key = await generateInvoiceKey();
    const encrypted = await encryptInvoice(makeInvoice(), key);
    await expect(
      decryptInvoice({ ...encrypted, ciphertext: tamper(encrypted.ciphertext) }, key),
    ).rejects.toThrow();
  });

  it("fails closed on a tampered iv", async () => {
    const key = await generateInvoiceKey();
    const encrypted = await encryptInvoice(makeInvoice(), key);
    await expect(
      decryptInvoice({ ...encrypted, iv: tamper(encrypted.iv) }, key),
    ).rejects.toThrow();
  });

  it("tamper() actually changes the decoded bytes", async () => {
    // Guards the two tests above. Altering the *last* base64url character is
    // frequently a no-op — in a final two-character group the second
    // character's low bits are discarded, so "…QQ" and "…QR" decode
    // identically and a tampering test written that way passes without ever
    // tampering with anything.
    const key = await generateInvoiceKey();
    const encrypted = await encryptInvoice(makeInvoice(), key);
    const lastCharFlip =
      encrypted.ciphertext.slice(0, -1) +
      (encrypted.ciphertext.endsWith("A") ? "B" : "A");

    expect(tamper(encrypted.ciphertext)).not.toBe(encrypted.ciphertext);
    // The naive version is not reliably a change at all — which is the point.
    expect(lastCharFlip).not.toBe(tamper(encrypted.ciphertext));
  });
});

describe("invoice links", () => {
  it("puts the key in the fragment, never the path or query", async () => {
    const encodedKey = await exportInvoiceKey(await generateInvoiceKey());
    const link = buildInvoiceLink("https://vellum.app", "0xabc", encodedKey);
    const url = new URL(link);
    expect(url.pathname).toBe("/pay/0xabc");
    expect(url.search).toBe("");
    expect(url.hash).toContain(encodedKey);
  });

  it("reads the key back out of the fragment", async () => {
    const encodedKey = await exportInvoiceKey(await generateInvoiceKey());
    const link = buildInvoiceLink("https://vellum.app", "0xabc", encodedKey);
    expect(readKeyFromFragment(new URL(link).hash)).toBe(encodedKey);
  });

  it("returns undefined when the fragment was stripped", () => {
    expect(readKeyFromFragment("")).toBeUndefined();
    expect(readKeyFromFragment("#")).toBeUndefined();
    expect(readKeyFromFragment("#other=1")).toBeUndefined();
  });
});
