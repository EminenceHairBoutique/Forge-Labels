/**
 * Pure pieces of the batch-verification feature (node-testable, no
 * Supabase imports): the record shapes, field-row hygiene, and the
 * SHA-256 used to fingerprint uploaded COA files.
 */

export interface BatchFieldRow {
  label: string;
  value: string;
}

export interface BatchRecord {
  id: string;
  token: string;
  productName: string;
  batchCode: string;
  fields: BatchFieldRow[];
  notice: string | null;
  coaPath: string | null;
  coaSha256: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export const MAX_FIELD_ROWS = 20;

/**
 * Trim, drop empty rows, cap counts and lengths. The content itself is
 * NEVER altered beyond whitespace — values are the owner's words
 * (research honesty: display verbatim, invent nothing).
 */
export function sanitizeFieldRows(rows: readonly BatchFieldRow[]): BatchFieldRow[] {
  return rows
    .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
    .filter((row) => row.label.length > 0 && row.value.length > 0)
    .slice(0, MAX_FIELD_ROWS)
    .map((row) => ({ label: row.label.slice(0, 80), value: row.value.slice(0, 400) }));
}

/** Parse the RPC's jsonb into typed rows, ignoring malformed entries. */
export function parseFieldRows(raw: unknown): BatchFieldRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: BatchFieldRow[] = [];
  for (const entry of raw) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { label?: unknown }).label === "string" &&
      typeof (entry as { value?: unknown }).value === "string"
    ) {
      rows.push({
        label: (entry as { label: string }).label,
        value: (entry as { value: string }).value,
      });
    }
  }
  return rows;
}

/** Lowercase-hex SHA-256 of a byte buffer (WebCrypto — browser and node). */
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = bytes instanceof Uint8Array ? toArrayBuffer(bytes) : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
