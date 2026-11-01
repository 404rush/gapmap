// Browser storage for the working session and past analyses. Uses IndexedDB
// (room for full source texts); falls back to memory when it's unavailable,
// e.g. in a private window, so the app still works without saving.

const DB_NAME = "gapmap";
const STORE = "kv";
const memory = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function getItem<T>(key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory.get(key) as T | undefined;
  return run<T>("readonly", (s) => s.get(key));
}

export async function setItem(key: string, value: unknown): Promise<boolean> {
  const db = await open();
  if (!db) {
    memory.set(key, value);
    return false;
  }
  const ok = await run("readwrite", (s) => s.put(value, key));
  return ok !== undefined;
}

export async function removeItem(key: string): Promise<void> {
  const db = await open();
  if (!db) {
    memory.delete(key);
    return;
  }
  await run("readwrite", (s) => s.delete(key));
}

export async function storageAvailable(): Promise<boolean> {
  return (await open()) !== null;
}
