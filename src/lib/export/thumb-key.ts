import type { LabelDocument } from "@/lib/document/schema";

/**
 * Cache key for a rendered thumbnail: a hash of everything that reaches
 * the pixels — the document itself (object ids stripped: engine rebuilds
 * mint fresh ids for identical layouts) plus the raster size. Template
 * redesigns change the built document, so stale entries invalidate
 * themselves; no version constant to remember to bump.
 */

/** FNV-1a over two 32-bit lanes — collision-safe at cache scale. */
function fnv1a64(text: string): string {
  let a = 0x811c9dc5;
  let b = 0xcbf29ce4;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((c << 1) | 1), 0x01000193) >>> 0;
  }
  return `${a.toString(36)}${b.toString(36)}`;
}

export function stableDocKey(doc: LabelDocument, maxPx: number): string {
  const json = JSON.stringify(doc, (key, value: unknown) =>
    key === "id" ? undefined : value,
  );
  return `${maxPx}:${fnv1a64(json)}`;
}
