// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { FINISHES } from "./types";
import {
  FINISH_TILE_DENSITY_PX_PER_MM,
  FINISH_TILE_SIZE_PX,
  SUPPORTED_FINISH_IDS,
  generateFinishTile,
  mulberry32,
} from "./patterns";

// Note: jsdom (without node-canvas) returns null from getContext("2d"); the
// engine must still hand back a correctly sized blank canvas without throwing,
// which is exactly what these tests rely on.

describe("generateFinishTile", () => {
  it("returns null for unknown finish ids", () => {
    expect(generateFinishTile("not-a-finish", { intensity: 0.5 })).toBeNull();
    expect(generateFinishTile("", { intensity: 0.5 })).toBeNull();
    // ids are case-sensitive
    expect(generateFinishTile("HOLO-RAINBOW", { intensity: 0.5 })).toBeNull();
  });

  it("covers every catalog finish id in its generator registry", () => {
    const catalogIds = FINISHES.map((f) => f.id).sort();
    expect([...SUPPORTED_FINISH_IDS].sort()).toEqual(catalogIds);
    expect(SUPPORTED_FINISH_IDS).toHaveLength(12);
  });

  it("renders a 512×512 canvas for all 12 finishes without throwing", () => {
    for (const finish of FINISHES) {
      const tile = generateFinishTile(finish.id, { intensity: 0.8 });
      expect(tile, `tile for ${finish.id}`).toBeInstanceOf(HTMLCanvasElement);
      expect(tile?.width, `width of ${finish.id}`).toBe(FINISH_TILE_SIZE_PX);
      expect(tile?.height, `height of ${finish.id}`).toBe(FINISH_TILE_SIZE_PX);
      expect(FINISH_TILE_SIZE_PX).toBe(512);
    }
  });

  it("returns the identical cached canvas for identical parameters", () => {
    const a = generateFinishTile("foil-gold", { intensity: 0.5 });
    const b = generateFinishTile("foil-gold", { intensity: 0.5 });
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it("quantizes intensity to a 0.05 cache grid and clamps out-of-range values", () => {
    const half = generateFinishTile("foil-gold", { intensity: 0.5 });
    // 0.51 rounds to the same 0.05 step as 0.5 → same cache entry.
    expect(generateFinishTile("foil-gold", { intensity: 0.51 })).toBe(half);
    // Out-of-range intensities clamp onto the 1.0 / 0.0 entries.
    expect(generateFinishTile("foil-gold", { intensity: 1.7 })).toBe(
      generateFinishTile("foil-gold", { intensity: 1 }),
    );
    expect(generateFinishTile("foil-gold", { intensity: -0.4 })).toBe(
      generateFinishTile("foil-gold", { intensity: 0 }),
    );
  });

  it("keeps distinct cache entries per intensity step and per finish", () => {
    const low = generateFinishTile("glitter", { intensity: 0.2 });
    const high = generateFinishTile("glitter", { intensity: 0.9 });
    const otherFinish = generateFinishTile("kraft", { intensity: 0.2 });
    expect(low).not.toBeNull();
    expect(low).not.toBe(high);
    expect(low).not.toBe(otherFinish);
  });

  it("exports the tile raster density the fill resolver maps back to mm", () => {
    expect(FINISH_TILE_DENSITY_PX_PER_MM).toBe(12);
  });
});

describe("mulberry32", () => {
  it("produces the identical sequence for the same seed", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seqA = Array.from({ length: 16 }, () => a());
    const seqB = Array.from({ length: 16 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("emits floats in [0, 1)", () => {
    const rand = mulberry32(0xdecafbad);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
