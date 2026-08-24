import { describe, expect, it } from "vitest";

import { STATUS_CLASS, STATUS_LABEL, daysUntilDue, invoiceStatus } from "./status";
import type { InvoiceStatus } from "./types";

const NOW = 1_700_000_000_000; // fixed instant, ms
const DUE_AT = Math.floor(NOW / 1000); // the same instant, in seconds

describe("invoiceStatus", () => {
  it("is paid regardless of the due date", () => {
    expect(invoiceStatus({ dueAt: DUE_AT - 86_400, isPaid: true, now: NOW })).toBe("paid");
  });

  it("is not overdue on the day it falls due — the boundary is strict", () => {
    expect(invoiceStatus({ dueAt: DUE_AT, isPaid: false, now: NOW })).toBe("awaiting");
  });

  it("becomes overdue the instant it passes the due date", () => {
    expect(invoiceStatus({ dueAt: DUE_AT, isPaid: false, now: NOW + 1 })).toBe("overdue");
  });

  it("is awaiting before the due date", () => {
    expect(invoiceStatus({ dueAt: DUE_AT + 86_400, isPaid: false, now: NOW })).toBe("awaiting");
  });

  it("defaults `now` to the real clock", () => {
    // Far enough in either direction that this cannot flake against the
    // actual wall clock, without needing to fake it.
    expect(invoiceStatus({ dueAt: 0, isPaid: false })).toBe("overdue");
    expect(invoiceStatus({ dueAt: 4_102_444_800, isPaid: false })).toBe("awaiting");
  });

  it("covers every InvoiceStatus in both label and class maps", () => {
    const statuses: InvoiceStatus[] = ["awaiting", "paid", "overdue"];
    for (const status of statuses) {
      expect(STATUS_LABEL[status]).toBeTruthy();
      expect(STATUS_CLASS[status]).toBeTruthy();
    }
  });
});

describe("daysUntilDue", () => {
  it("is zero at the exact due instant", () => {
    expect(daysUntilDue(DUE_AT, NOW)).toBe(0);
  });

  it("rounds a partial day up to a whole day", () => {
    // One second short of two full days away.
    expect(daysUntilDue(DUE_AT + 172_799, NOW)).toBe(2);
  });

  it("is exactly 1 a full day out", () => {
    expect(daysUntilDue(DUE_AT + 86_400, NOW)).toBe(1);
  });

  it("is negative once overdue", () => {
    expect(daysUntilDue(DUE_AT - 172_800, NOW)).toBe(-2);
  });

  it("defaults `now` to the real clock", () => {
    expect(daysUntilDue(0)).toBeLessThan(0);
  });
});
