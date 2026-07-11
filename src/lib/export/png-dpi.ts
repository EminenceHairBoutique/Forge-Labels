/**
 * PNG pHYs chunk injection — stamps physical resolution (DPI) into exported
 * PNGs so print shops and OS preview tools see the intended size instead of
 * assuming 72/96 DPI. Pure bytes in/out; unit-tested in Node.
 */

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const METERS_PER_INCH = 0.0254;

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!,
  );
}

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

function buildPhysChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi / METERS_PER_INCH);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  writeUint32(chunk, 0, 9); // data length
  chunk[4] = 0x70; // p
  chunk[5] = 0x48; // H
  chunk[6] = 0x59; // Y
  chunk[7] = 0x73; // s
  writeUint32(chunk, 8, ppm);
  writeUint32(chunk, 12, ppm);
  chunk[16] = 1; // unit: meter
  const crc = crc32(chunk.subarray(4, 17));
  writeUint32(chunk, 17, crc);
  return chunk;
}

/**
 * Return a copy of `bytes` with a pHYs chunk carrying `dpi`, inserted right
 * after IHDR (replacing an existing pHYs if present). Throws on non-PNGs.
 */
export function setPngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (!isPng(bytes)) throw new Error("Not a PNG file");

  const phys = buildPhysChunk(dpi);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let inserted = false;

  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = chunkType(bytes, offset + 4);
    const total = 8 + length + 4;
    const chunk = bytes.subarray(offset, offset + total);

    if (type === "pHYs") {
      // Drop existing pHYs; ours is inserted after IHDR.
      offset += total;
      continue;
    }
    parts.push(chunk);
    if (type === "IHDR" && !inserted) {
      parts.push(phys);
      inserted = true;
    }
    offset += total;
    if (type === "IEND") break;
  }

  if (!inserted) throw new Error("PNG has no IHDR chunk");

  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/** Read the pHYs DPI from a PNG, if present (for tests/verification). */
export function readPngDpi(bytes: Uint8Array): number | null {
  if (!isPng(bytes)) return null;
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = chunkType(bytes, offset + 4);
    if (type === "pHYs") {
      const ppmX = readUint32(bytes, offset + 8);
      const unit = bytes[offset + 16];
      if (unit !== 1) return null;
      return Math.round(ppmX * METERS_PER_INCH);
    }
    offset += 8 + length + 4;
    if (type === "IEND") break;
  }
  return null;
}
