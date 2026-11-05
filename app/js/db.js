// IndexedDB storage: the whole app state in one record, plus daily restore points.
// IndexedDB is not touched by Portion's localStorage.clear() on the same site.

const DB_NAME = "musculation";
const DB_VERSION = 1;
const KEEP_SNAPSHOTS = 30;

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
        if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(storeName, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = fn(store);
        tx.oncomplete = () => resolve(result && "result" in result ? result.result : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export function loadState() {
  return run("state", "readonly", (s) => s.get("main"));
}

export function saveState(state) {
  return run("state", "readwrite", (s) => s.put(state, "main"));
}

/** Keeps one copy per day, the latest of the day, and drops the oldest past 30. */
export async function saveSnapshot(state, day) {
  await run("snapshots", "readwrite", (s) => s.put({ day, savedAt: new Date().toISOString(), state }, day));
  const days = await listSnapshotDays();
  const extra = days.slice(KEEP_SNAPSHOTS);
  if (extra.length) await run("snapshots", "readwrite", (s) => extra.forEach((d) => s.delete(d)));
}

/** Days with a restore point, newest first. */
export async function listSnapshotDays() {
  const keys = await run("snapshots", "readonly", (s) => s.getAllKeys());
  return [...keys].sort().reverse();
}

export function loadSnapshot(day) {
  return run("snapshots", "readonly", (s) => s.get(day));
}

/** Asks the browser not to clear the data when space runs low. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
