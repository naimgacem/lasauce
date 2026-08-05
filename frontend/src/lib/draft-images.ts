/**
 * Persistence for the report wizard's selected photos.
 *
 * The text draft lives in localStorage, but `File` objects cannot be
 * JSON-serialised — so a refresh used to bring the whole draft back while
 * silently dropping every photo the user had picked. IndexedDB stores `File`
 * natively via structured clone, so photos now survive a reload like the rest
 * of the draft.
 *
 * Every operation degrades to a no-op rather than throwing: private-browsing
 * modes and blocked storage must never be able to break publishing.
 */

const DB_NAME = "lostfound-draft";
const STORE = "images";
const KEY = "current";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** Resolve once the write settles, whichever way it settles. */
function commit(db: IDBDatabase, run: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE, "readwrite");
    run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

export async function saveDraftImages(files: File[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await commit(db, (store) => store.put(files, KEY));
  db.close();
}

export async function loadDraftImages(): Promise<File[]> {
  const db = await openDb();
  if (!db) return [];
  const stored = await new Promise<unknown>((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  db.close();
  // Anything that isn't a real File is discarded — the store is user-writable
  // and a stale shape must not reach the uploader.
  return Array.isArray(stored) ? stored.filter((f): f is File => f instanceof File) : [];
}

export async function clearDraftImages(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await commit(db, (store) => store.delete(KEY));
  db.close();
}
