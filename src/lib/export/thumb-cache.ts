"use client";

import type { LabelDocument } from "@/lib/document/schema";
import { renderThumbnail } from "./raster";
import { stableDocKey } from "./thumb-key";

/**
 * Persistent thumbnail cache. The template browser and wizard render
 * dozens of small labels per visit; every pixel is a pure function of the
 * built document, so revisits can paint from IndexedDB instead of running
 * fonts + Konva again. Failures fall through to a live render — the cache
 * can only make things faster, never wronger.
 */

const DB_NAME = "fl-thumbs";
const STORE = "thumbs";
const MAX_ENTRIES = 400;
const PRUNE_EVERY = 25;

interface ThumbRow {
  key: string;
  dataUrl: string;
  at: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let putsSincePrune = 0;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" }).createIndex("at", "at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("IndexedDB unavailable"));
    };
  });
  return dbPromise;
}

function idbGet(key: string): Promise<ThumbRow | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(STORE).objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result as ThumbRow | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(row: ThumbRow): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/** Drop the oldest rows beyond MAX_ENTRIES (by last-used time). */
async function prune(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const excess = countReq.result - MAX_ENTRIES;
      if (excess <= 0) {
        resolve();
        return;
      }
      let removed = 0;
      const cursorReq = store.index("at").openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || removed >= excess) {
          resolve();
          return;
        }
        cursor.delete();
        removed += 1;
        cursor.continue();
      };
      cursorReq.onerror = () => resolve();
    };
    countReq.onerror = () => resolve();
  });
}

/**
 * renderThumbnail with a persistent cache in front of it. Hits refresh
 * their last-used stamp so frequently-browsed templates stay resident.
 */
export async function renderThumbnailCached(
  doc: LabelDocument,
  maxPx = 480,
): Promise<string> {
  if (typeof indexedDB === "undefined") return renderThumbnail(doc, maxPx);
  const key = stableDocKey(doc, maxPx);
  try {
    const hit = await idbGet(key);
    if (hit) {
      void idbPut({ ...hit, at: Date.now() }).catch(() => {});
      return hit.dataUrl;
    }
  } catch {
    // Cache read failed (private mode, quota) — render live.
  }
  const dataUrl = await renderThumbnail(doc, maxPx);
  void idbPut({ key, dataUrl, at: Date.now() })
    .then(() => {
      putsSincePrune += 1;
      if (putsSincePrune >= PRUNE_EVERY) {
        putsSincePrune = 0;
        return prune();
      }
      return undefined;
    })
    .catch(() => {});
  return dataUrl;
}
