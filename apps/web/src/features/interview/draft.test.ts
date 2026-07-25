// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clearDraft, readDraft, storageAvailable, writeDraft } from "./draft";
import { GUEST_DRAFT_VERSION, type GuestDraft } from "./draft-schema";

const DRAFT: GuestDraft = {
  version: GUEST_DRAFT_VERSION,
  name: "Loop CRM",
  description: "A lightweight CRM for small agencies that hate admin.",
  answers: { productType: "saas", vision: "A CRM they keep using." }
};

const STORAGE_KEY = "airrow-guest-interview";

/**
 * An in-memory Storage, installed explicitly rather than leaning on the ambient one.
 * jsdom drops localStorage on an opaque origin, and Node ≥25 ships its own experimental
 * global that shadows it — neither is something these tests should depend on.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear()
  };
}

/** A Storage that refuses to write — private mode, blocked storage, or a full quota. */
function hostileStorage(): Storage {
  return {
    ...memoryStorage(),
    setItem: () => {
      throw new DOMException("QuotaExceededError");
    }
  };
}

function install(storage: Storage): void {
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}

describe("the guest draft store", () => {
  beforeEach(() => install(memoryStorage()));
  afterEach(() => clearDraft());

  it("round-trips a draft", () => {
    expect(writeDraft(DRAFT)).toBe(true);
    expect(readDraft()).toEqual(DRAFT);
  });

  it("reports no draft when nothing is stored", () => {
    expect(readDraft()).toBeNull();
  });

  it("discards a draft written by an older version", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DRAFT, version: GUEST_DRAFT_VERSION - 1 })
    );

    expect(readDraft()).toBeNull();
    // Dropped rather than left to fail again on the next load.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("discards unparseable storage instead of throwing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    expect(readDraft()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("discards a draft whose answers are outside the schema", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DRAFT, answers: { hosting: "my-basement" } })
    );

    expect(readDraft()).toBeNull();
  });

  it("clears on request", () => {
    writeDraft(DRAFT);
    clearDraft();
    expect(readDraft()).toBeNull();
  });

  it("reports a working store as available", () => {
    expect(storageAvailable()).toBe(true);
  });

  it("reports blocked storage rather than throwing, so the UI can warn", () => {
    install(hostileStorage());

    expect(storageAvailable()).toBe(false);
    expect(writeDraft(DRAFT)).toBe(false);
    expect(readDraft()).toBeNull();
  });
});
