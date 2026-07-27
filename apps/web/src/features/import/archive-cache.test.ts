// Caching the founder's archive (spec 68). The failure paths matter most: if the browser refuses
// to store the archive, the import must still succeed and the founder must be told — otherwise the
// download later asks for a file again with no explanation of why.
//
// IndexedDB is stubbed rather than polyfilled: quota exhaustion and blocked storage cannot be
// provoked reliably in a real browser, and they are exactly what needs covering.
import { describe, it, expect, afterEach } from "vitest";
import { cacheArchive, hasCachedArchive, readCachedArchive } from "./archive-cache";

type Handler = (() => void) | null;

interface FakeRequest {
  result: unknown;
  error: Error | null;
  onsuccess: Handler;
  onerror: Handler;
  onupgradeneeded: Handler;
}

const newRequest = (): FakeRequest => ({
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null
});

/** Only as much of IndexedDB as `archive-cache.ts` actually touches. */
function stubIndexedDB(options: { failOpen?: boolean; failRequest?: boolean } = {}): Map<string, unknown> {
  const stored = new Map<string, unknown>();
  const transaction = { onabort: null as Handler, error: new Error("QuotaExceededError") };

  const store = {
    transaction,
    put(value: unknown, key: string) {
      const request = newRequest();
      queueMicrotask(() => {
        if (options.failRequest) {
          request.error = new Error("QuotaExceededError");
          request.onerror?.();
          return;
        }
        stored.set(key, value);
        request.onsuccess?.();
      });
      return request;
    },
    get(key: string) {
      const request = newRequest();
      queueMicrotask(() => {
        if (options.failRequest) {
          request.error = new Error("read failed");
          request.onerror?.();
          return;
        }
        request.result = stored.get(key) ?? undefined;
        request.onsuccess?.();
      });
      return request;
    },
    count(key: string) {
      const request = newRequest();
      queueMicrotask(() => {
        if (options.failRequest) {
          request.error = new Error("count failed");
          request.onerror?.();
          return;
        }
        request.result = stored.has(key) ? 1 : 0;
        request.onsuccess?.();
      });
      return request;
    }
  };

  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => store,
    transaction: () => ({ objectStore: () => store }),
    close: () => undefined
  };

  const factory = {
    open() {
      const request = newRequest();
      queueMicrotask(() => {
        if (options.failOpen) {
          request.error = new Error("storage blocked");
          request.onerror?.();
          return;
        }
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };

  // The stub implements only the surface this module uses; a structural IDBFactory would mean
  // hand-writing the whole spec for no extra coverage.
  globalThis.indexedDB = factory as unknown as IDBFactory;
  return stored;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "indexedDB");
});

const archive = (): Blob => new Blob(["zip bytes"], { type: "application/zip" });

describe("cacheArchive", () => {
  it("stores the archive against the project", async () => {
    const stored = stubIndexedDB();
    const result = await cacheArchive("project-1", archive());
    expect(result).toEqual({ ok: true });
    expect(stored.has("project-1")).toBe(true);
  });

  it("reports failure instead of throwing when the archive exceeds the quota", async () => {
    stubIndexedDB({ failRequest: true });
    const result = await cacheArchive("project-1", archive());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBeTruthy();
  });

  it("reports failure when storage is blocked outright, as in private browsing", async () => {
    stubIndexedDB({ failOpen: true });
    const result = await cacheArchive("project-1", archive());
    expect(result.ok).toBe(false);
  });

  it("does not throw when IndexedDB is missing altogether", async () => {
    const result = await cacheArchive("project-1", archive());
    expect(result.ok).toBe(false);
  });
});

describe("hasCachedArchive", () => {
  it("answers without reading the archive back, so a 50 MB blob is never loaded to answer it", async () => {
    stubIndexedDB();
    await cacheArchive("project-1", archive());
    expect(await hasCachedArchive("project-1")).toBe(true);
  });

  it("is false for a project this browser never held", async () => {
    stubIndexedDB();
    expect(await hasCachedArchive("never-imported-here")).toBe(false);
  });

  it("is false rather than throwing when storage is unavailable", async () => {
    stubIndexedDB({ failOpen: true });
    expect(await hasCachedArchive("project-1")).toBe(false);
  });
});

describe("readCachedArchive", () => {
  it("returns what was cached", async () => {
    stubIndexedDB();
    await cacheArchive("project-1", archive());
    expect(await readCachedArchive("project-1")).toBeInstanceOf(Blob);
  });

  it("returns null for a project this browser never held", async () => {
    stubIndexedDB();
    expect(await readCachedArchive("never-imported-here")).toBeNull();
  });

  it("returns null rather than throwing when storage is unavailable", async () => {
    stubIndexedDB({ failOpen: true });
    expect(await readCachedArchive("project-1")).toBeNull();
  });
});
