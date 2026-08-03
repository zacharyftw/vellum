import { describe, expect, it } from "vitest";

import { anchorMatches, isChainEvidence, type OnChainAnchor } from "./registry";

const INVOICE_COMMITMENT =
  "0x3fa16f611d2af092e4e2f21372484f0d8c3b7a66ece2be6e870206117235945";
const PAYMENT_COMMITMENT =
  "0x4dfa95e7188ffa2ebf611632c36dad2cf06cdb44d684462a1a9e13c8eaa82a9";

function anchor(commitment: string): OnChainAnchor {
  return { commitment, anchoredAt: 1_760_000_000, paymentCommitment: null, paidAt: null };
}

describe("anchorMatches", () => {
  it("recognises an invoice anchored by the issuer before payment", () => {
    expect(
      anchorMatches(anchor(INVOICE_COMMITMENT), INVOICE_COMMITMENT, PAYMENT_COMMITMENT),
    ).toBe("invoice");
  });

  it("recognises an invoice anchored by settlement itself", () => {
    // Regression, from the first real payment on Sepolia. The contract writes
    // the *payment* commitment when an invoice was never anchored early —
    // it is the only value the buyer's transaction carries. Comparing against
    // the invoice commitment alone reported a correctly paid invoice as a
    // forgery, on the one page whose entire job is to be believed.
    expect(
      anchorMatches(anchor(PAYMENT_COMMITMENT), INVOICE_COMMITMENT, PAYMENT_COMMITMENT),
    ).toBe("payment");
  });

  it("reports a genuine mismatch", () => {
    expect(
      anchorMatches(anchor("0xdead"), INVOICE_COMMITMENT, PAYMENT_COMMITMENT),
    ).toBe("neither");
  });

  it("does not accept a payment commitment that was not offered", () => {
    // Without the payment commitment there is nothing to match it against, so
    // the honest answer is "neither" rather than a guess.
    expect(anchorMatches(anchor(PAYMENT_COMMITMENT), INVOICE_COMMITMENT)).toBe(
      "neither",
    );
  });

  it("compares felts numerically, not as strings", () => {
    const padded = `0x${INVOICE_COMMITMENT.slice(2).padStart(64, "0")}`;
    expect(anchorMatches(anchor(padded), INVOICE_COMMITMENT)).toBe("invoice");
  });

  it("returns 'neither' rather than throwing on a malformed value", () => {
    expect(anchorMatches(anchor("not-a-felt"), INVOICE_COMMITMENT)).toBe("neither");
  });
});

describe("isChainEvidence", () => {
  it("counts an answer from the chain as evidence", () => {
    expect(isChainEvidence({ status: "found", anchor: anchor("0x1") })).toBe(true);
    expect(isChainEvidence({ status: "absent" })).toBe(true);
  });

  it("does not count a failure to ask as evidence", () => {
    // The distinction this module exists for: rendering ignorance as evidence
    // is the bug, in either direction.
    expect(isChainEvidence({ status: "unavailable", reason: "no-registry" })).toBe(false);
    expect(isChainEvidence({ status: "unavailable", reason: "no-provider" })).toBe(false);
    expect(isChainEvidence({ status: "error", message: "boom" })).toBe(false);
  });
});
