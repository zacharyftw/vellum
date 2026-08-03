import { describe, expect, it } from "vitest";

import { describeStrk20Error } from "./errors";

/**
 * Real revert text, as a wallet surfaces it. The Cairo constant arrives buried
 * in proof and syscall noise rather than on its own — a translator that only
 * matched exact strings would pass its tests and fail every real transaction.
 */
const REVERT_NOISE =
  "Transaction execution has failed:\n0x...: Error at pc=0:81:\nGot an exception while executing a hint: Execution failed. Failure reason: 0x524543495049454e545f4e4f545f524547495354455245 ('RECIPIENT_NOT_REGISTERED').\n";

describe("describeStrk20Error", () => {
  it("finds the reason inside a full revert dump", () => {
    const described = describeStrk20Error(new Error(REVERT_NOISE));
    expect(described.message).toContain("has not been set up to receive");
    expect(described.action).toContain("ask them");
    expect(described.isRejection).toBe(false);
  });

  it("names the party who can actually fix it", () => {
    // The buyer hits this error, but only the supplier can resolve it. A
    // message that says "try again" would send them in a loop.
    const described = describeStrk20Error(new Error("RECIPIENT_NOT_REGISTERED"));
    expect(described.action).toMatch(/only they can fix this/i);
    expect(described.message).toContain("supplier");
  });

  it("distinguishes the sender's own registration from the recipient's", () => {
    const recipient = describeStrk20Error(new Error("RECIPIENT_NOT_REGISTERED"));
    const sender = describeStrk20Error(new Error("SENDER_NOT_REGISTERED"));
    expect(sender.message).toContain("Your account");
    expect(sender.message).not.toBe(recipient.message);
  });

  it("reads an insufficient shielded balance as a balance problem", () => {
    const described = describeStrk20Error(new Error("NEGATIVE_INTERMEDIATE_BALANCE"));
    expect(described.message).toContain("shielded balance is too small");
    expect(described.action).toContain("privacy pool");
  });

  it("treats a dismissed wallet prompt as a rejection, not a fault", () => {
    for (const raw of [
      "User rejected the request",
      "user abort",
      "The user denied the transaction",
      "Request declined",
    ]) {
      const described = describeStrk20Error(new Error(raw));
      expect(described.isRejection).toBe(true);
      expect(described.action).toBeUndefined();
    }
  });

  it("passes through anything it does not recognise", () => {
    // Inventing a friendly message for an unknown fault would discard the only
    // clue available.
    const raw = "Some entirely novel node failure";
    const described = describeStrk20Error(new Error(raw));
    expect(described.message).toBe(raw);
    expect(described.isRejection).toBe(false);
  });

  it("always keeps the raw text", () => {
    expect(describeStrk20Error(new Error(REVERT_NOISE)).raw).toBe(REVERT_NOISE);
  });

  it("handles a non-Error throw", () => {
    expect(describeStrk20Error("RECIPIENT_NOT_REGISTERED").message).toContain(
      "has not been set up to receive",
    );
    expect(describeStrk20Error(undefined).message).toBe("undefined");
  });
});
