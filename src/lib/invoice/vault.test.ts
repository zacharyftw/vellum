import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  findInvoiceKey,
  forgetInvoice,
  listInvoices,
  readVault,
  rememberInvoice,
  type VaultEntry,
} from "./vault";

/**
 * `vault.ts` guards every read/write behind `isBrowser()` — a check for a
 * global `window` and `localStorage` — and this suite runs in vitest's `node`
 * environment (see vitest.config.ts), where neither exists by default. A tiny
 * in-memory `Storage` is enough to exercise the real logic rather than only
 * the "no browser" fallback; the module's contract is "whatever
 * `localStorage` gives it", not any particular storage engine.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const STORAGE_KEY = "vellum.vault.v1";
const ENTRY: Omit<VaultEntry, "savedAt"> = {
  id: "0x1",
  key: "k1",
  role: "issuer",
  network: "sepolia",
};

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("readVault", () => {
  it("returns an empty array when nothing has been saved", () => {
    expect(readVault()).toEqual([]);
  });

  it("returns [] rather than throwing on malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readVault()).toEqual([]);
  });

  it("returns [] when the stored value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(readVault()).toEqual([]);
  });

  it("filters out entries missing an id or a key", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { ...ENTRY, savedAt: 1 },
        { id: "0x2" },
        { key: "onlykey" },
        null,
        "garbage",
      ]),
    );
    expect(readVault()).toEqual([{ ...ENTRY, savedAt: 1 }]);
  });
});

describe("rememberInvoice", () => {
  it("adds a new entry with a savedAt timestamp", () => {
    rememberInvoice(ENTRY);
    const [saved] = readVault();
    expect(saved).toMatchObject(ENTRY);
    expect(typeof saved.savedAt).toBe("number");
  });

  it("keeps the original savedAt when an existing entry is updated", () => {
    rememberInvoice(ENTRY);
    const originalSavedAt = readVault()[0].savedAt;

    rememberInvoice({ ...ENTRY, key: "rotated-key" });
    const updated = readVault()[0];

    expect(updated.savedAt).toBe(originalSavedAt);
    expect(updated.key).toBe("rotated-key");
  });

  it("does not downgrade an issuer to a payer on re-save", () => {
    rememberInvoice({ ...ENTRY, role: "issuer" });
    rememberInvoice({ ...ENTRY, role: "payer" });
    expect(readVault()[0].role).toBe("issuer");
  });

  it("upgrades a payer to issuer once the same invoice is issued here", () => {
    rememberInvoice({ ...ENTRY, role: "payer" });
    rememberInvoice({ ...ENTRY, role: "issuer" });
    expect(readVault()[0].role).toBe("issuer");
  });
});

describe("findInvoiceKey", () => {
  it("finds a saved entry by id", () => {
    rememberInvoice(ENTRY);
    expect(findInvoiceKey(ENTRY.id)).toMatchObject(ENTRY);
  });

  it("returns undefined for an id that was never saved", () => {
    expect(findInvoiceKey("0xnope")).toBeUndefined();
  });
});

describe("forgetInvoice", () => {
  it("removes only the named entry", () => {
    const other = { ...ENTRY, id: "0x2" };
    rememberInvoice(ENTRY);
    rememberInvoice(other);

    forgetInvoice(ENTRY.id);

    expect(readVault()).toHaveLength(1);
    expect(readVault()[0]).toMatchObject(other);
  });

  it("is a no-op for an id that is not present", () => {
    rememberInvoice(ENTRY);
    forgetInvoice("0xnope");
    expect(readVault()).toHaveLength(1);
  });
});

describe("listInvoices", () => {
  it("orders newest first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    rememberInvoice({ ...ENTRY, id: "0x1" });
    vi.setSystemTime(2_000);
    rememberInvoice({ ...ENTRY, id: "0x2" });

    expect(listInvoices().map((entry) => entry.id)).toEqual(["0x2", "0x1"]);
  });
});
