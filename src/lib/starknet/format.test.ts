import { describe, expect, it } from "vitest";

import {
  formatAmount,
  formatAmountPretty,
  parseAmount,
  prettyStatus,
  shortHex,
} from "./format";

const DECIMALS = 18;
const ONE = 10n ** 18n;

describe("parseAmount", () => {
  it("parses whole and fractional amounts", () => {
    expect(parseAmount("1", DECIMALS)).toBe(ONE);
    expect(parseAmount("1.5", DECIMALS)).toBe(ONE + ONE / 2n);
    expect(parseAmount("0", DECIMALS)).toBe(0n);
  });

  it("keeps the smallest representable unit", () => {
    expect(parseAmount("0.000000000000000001", DECIMALS)).toBe(1n);
  });

  it("survives amounts far past what a float could hold", () => {
    // 2^53 tokens — a JS number rounds this; the invoice must not.
    expect(parseAmount("9007199254740993", DECIMALS)).toBe(
      9007199254740993n * ONE,
    );
  });

  it("rejects more precision than the token has", () => {
    // Truncating here would silently alter a customer's invoice total.
    expect(() => parseAmount("1.0000000000000000001", DECIMALS)).toThrow();
  });

  it("rejects anything that is not a plain non-negative decimal", () => {
    for (const bad of ["", "abc", "-1", "1e18", "1.2.3", "0x1", " ", "1,5"]) {
      expect(() => parseAmount(bad, DECIMALS)).toThrow();
    }
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseAmount("  2.5  ", DECIMALS)).toBe(ONE * 5n / 2n);
  });
});

describe("formatAmount", () => {
  it("round-trips with parseAmount", () => {
    for (const value of ["0", "1", "1.5", "0.000000000000000001", "123456.789"]) {
      expect(formatAmount(parseAmount(value, DECIMALS), DECIMALS)).toBe(value);
    }
  });

  it("drops trailing fractional zeroes", () => {
    expect(formatAmount(ONE, DECIMALS)).toBe("1");
    expect(formatAmount(ONE + ONE / 2n, DECIMALS)).toBe("1.5");
  });

  it("handles negative values", () => {
    expect(formatAmount(-ONE, DECIMALS)).toBe("-1");
  });
});

describe("formatAmountPretty", () => {
  it("groups thousands and clamps the fraction", () => {
    expect(formatAmountPretty(parseAmount("12500.25", DECIMALS), DECIMALS)).toBe(
      "12,500.25",
    );
    expect(formatAmountPretty(parseAmount("1234567", DECIMALS), DECIMALS)).toBe(
      "1,234,567",
    );
    expect(
      formatAmountPretty(parseAmount("1.239", DECIMALS), DECIMALS, 2),
    ).toBe("1.23");
  });

  it("does not group short values", () => {
    expect(formatAmountPretty(parseAmount("999", DECIMALS), DECIMALS)).toBe("999");
  });
});

describe("shortHex", () => {
  it("shortens long hex and leaves short hex alone", () => {
    expect(shortHex("0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07")).toBe(
      "0x4718…ab07",
    );
    expect(shortHex("0x1")).toBe("0x1");
  });
});

describe("prettyStatus", () => {
  it("renders the common outcomes", () => {
    expect(prettyStatus("ACCEPTED_ON_L2", "SUCCEEDED")).toBe(
      "Accepted on L2 · Succeeded",
    );
    expect(prettyStatus("ACCEPTED_ON_L2", "REVERTED")).toBe(
      "Accepted on L2 · Reverted",
    );
    expect(prettyStatus(undefined, undefined)).toBe("Confirmed");
  });
});
