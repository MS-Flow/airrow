"use client";

// The founder's own archive, kept in their browser (spec 68).
//
// Airrow never stores the contents of an imported project, so the only place the original files
// still exist is the machine they were uploaded from. Caching the archive here is what lets the
// download contain the whole project instead of just Airrow's additions — and it keeps the source
// on the founder's device, which is the entire point.

const DB_NAME = "airrow-import";
const STORE = "archives";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

function run<T>(store: IDBObjectStore, request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    store.transaction.onabort = () =>
      reject(store.transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export type CacheResult = { ok: true } | { ok: false; reason: string };

/**
 * Keep the archive for later. Failure is expected and survivable — a 50 MB blob can exceed the
 * browser's quota — so it is reported rather than thrown, and the founder is told at import time
 * that the download will ask for the file again.
 */
export async function cacheArchive(projectId: string, archive: Blob): Promise<CacheResult> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    await run(store, store.put(archive, projectId));
    db.close();
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown error";
    return { ok: false, reason };
  }
}

/**
 * Whether this browser still holds the archive, without reading it back. The blob can be 50 MB, and
 * the download button only needs to know which of its two jobs it has before it is clicked.
 */
export async function hasCachedArchive(projectId: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readonly");
    const store = transaction.objectStore(STORE);
    const count = await run<number>(store, store.count(projectId));
    db.close();
    return count > 0;
  } catch {
    return false;
  }
}

/** The cached archive, or null when this browser never held it (another device, cleared storage). */
export async function readCachedArchive(projectId: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readonly");
    const store = transaction.objectStore(STORE);
    const value = await run<unknown>(store, store.get(projectId));
    db.close();
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}
