/**
 * Procedural simulated-material finish tiles.
 *
 * Each finish renders a 512×512 canvas at FINISH_TILE_DENSITY_PX_PER_MM
 * (12 px/mm → one tile ≈ 42.7 mm of material) that Konva repeats as a
 * fillPatternImage (see src/lib/render/fills.ts). Every tile therefore MUST
 * tile seamlessly: the right edge continues the left edge and the bottom
 * continues the top. Rotation is a separate user control applied by the
 * fill, so tiles only need a coherent internal direction, not rotational
 * symmetry.
 *
 * Seamlessness technique per finish:
 * - holo-rainbow   periodic functions only: hue swept over (x+y) and sheen
 *                  bands over (x−y), both with integer cycle counts per 512.
 * - holo-prism     jittered triangular grid on a wrapped (toroidal) lattice;
 *                  a one-cell border ring re-draws the wrapped cells shifted
 *                  ±512 px so edge facets continue across the seam.
 * - holo-wave      per-pixel phase field y/512·W + wobble(x) where W and the
 *                  wobble's cycle counts are integers, so both edges match.
 * - holo-dots      row-offset dot lattice whose pitch divides 512 exactly;
 *                  dots crossing an edge are re-drawn shifted ±512 px.
 * - holo-shatter   same wrapped triangulation as holo-prism, coarser cells,
 *                  harder contrast, dark fracture strokes.
 * - foil-*         integer-cycle diagonal sine sheen over (x+y) plus a faint
 *                  cross-sheen over (x−y); per-row micro-grain (rows are
 *                  inherently seamless in x); soft blotch radial gradients
 *                  drawn at all nine ±512 px wrap offsets.
 * - metal-brushed  per-row grain + integer-cycle column/row modulation;
 *                  bright strands crossing the x edge re-drawn shifted −512.
 * - metal-chrome   per-row band function of y with integer cycle counts
 *                  (rows are constant in x → trivially seamless in x).
 * - glitter        seeded flecks; any fleck near an edge is re-drawn at the
 *                  wrapped offsets (±512 in x and/or y).
 * - kraft          per-pixel fiber jitter + two octaves of value noise on a
 *                  wrapped lattice (indices mod N) + wrap-copied fiber
 *                  strokes.
 *
 * Determinism: no Math.random anywhere. Every generator draws from
 * mulberry32 with a fixed per-finish seed, so the editor preview and the
 * export raster are pixel-identical. Tiles are cached per
 * (finishId, intensity rounded to 0.05) — generation never runs per-frame.
 */

/** Raster density of finish tiles; fills map tile pixels → mm with this. */
export const FINISH_TILE_DENSITY_PX_PER_MM = 12;

/** Tile edge length in pixels (512 px ≈ 42.7 mm of simulated material). */
export const FINISH_TILE_SIZE_PX = 512;

export interface FinishTileOptions {
  /** Effect strength 0..1: 0 ≈ plain base tone, 1 = full material effect. */
  intensity: number;
}

/**
 * mulberry32 — tiny deterministic PRNG returning floats in [0, 1).
 * Exported as a pure function so determinism is unit-testable.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SIZE = FINISH_TILE_SIZE_PX;
const TAU = Math.PI * 2;

/** Fixed per-finish seeds — never change these or saved designs re-shuffle. */
const SEEDS = {
  prism: 0x18f3a2c1,
  shatter: 0x7c4d9e15,
  dots: 0x2fb56a83,
  gold: 0x5a1c8d37,
  silver: 0x91e04bf5,
  rose: 0x3d72c649,
  brushed: 0xa48e17db,
  chrome: 0x60b3f2ad,
  glitter: 0xc75d3891,
  kraft: 0x1e9a64f7,
} as const;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Stable hash of a lattice coordinate → [0, 1). Order-independent. */
function hash2(seed: number, x: number, y: number): number {
  const h =
    (seed ^ Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x79b9, 0xc2b2ae35)) >>> 0;
  return mulberry32(h)();
}

/** Standard normal via Box–Muller, clamped to ±3σ. */
function gauss(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  return g < -3 ? -3 : g > 3 ? 3 : g;
}

/** HSL (h deg, s/l %) → RGB 0..255 triple, for ImageData lookups. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp01(s / 100);
  const ln = clamp01(l / 100);
  if (sn === 0) {
    const v = ln * 255;
    return [v, v, v];
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (u: number): number => {
    let t = u;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(hn + 1 / 3) * 255, channel(hn) * 255, channel(hn - 1 / 3) * 255];
}

/** CSS hsl()/hsla() string with normalized hue. */
function hsl(h: number, s: number, l: number, a = 1): string {
  const hh = (((h % 360) + 360) % 360).toFixed(1);
  const ss = s.toFixed(1);
  const ll = l.toFixed(1);
  return a >= 1
    ? `hsl(${hh}, ${ss}%, ${ll}%)`
    : `hsla(${hh}, ${ss}%, ${ll}%, ${clamp01(a).toFixed(3)})`;
}

const ZERO_OFFSET: ReadonlyArray<readonly [number, number]> = [[0, 0]];

/**
 * Wrap-around duplication offsets for an element at (x, y) whose ink stays
 * within `margin` px of that point: elements near an edge are re-drawn
 * shifted by ±SIZE so the tile continues seamlessly.
 */
function wrapOffsets(
  x: number,
  y: number,
  margin: number,
): ReadonlyArray<readonly [number, number]> {
  const left = x < margin;
  const right = x > SIZE - margin;
  const top = y < margin;
  const bottom = y > SIZE - margin;
  if (!left && !right && !top && !bottom) return ZERO_OFFSET;
  const xs: number[] = [0];
  if (left) xs.push(SIZE);
  if (right) xs.push(-SIZE);
  const ys: number[] = [0];
  if (top) ys.push(SIZE);
  if (bottom) ys.push(-SIZE);
  const out: Array<readonly [number, number]> = [];
  for (const dx of xs) for (const dy of ys) out.push([dx, dy]);
  return out;
}

/**
 * Seamless value noise: random values on a cells×cells lattice, smoothstep
 * bilinear interpolation, lattice indices taken mod cells → wraps at 512.
 */
function makeWrappedNoise(
  rand: () => number,
  cells: number,
): (x: number, y: number) => number {
  const values = new Float64Array(cells * cells);
  for (let i = 0; i < values.length; i++) values[i] = rand();
  const cs = SIZE / cells;
  return (x, y) => {
    const gx = x / cs;
    const gy = y / cs;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const i0 = ix % cells;
    const i1 = (ix + 1) % cells;
    const j0 = iy % cells;
    const j1 = (iy + 1) % cells;
    const v00 = values[j0 * cells + i0] ?? 0;
    const v10 = values[j0 * cells + i1] ?? 0;
    const v01 = values[j1 * cells + i0] ?? 0;
    const v11 = values[j1 * cells + i1] ?? 0;
    return lerp(lerp(v00, v10, sx), lerp(v01, v11, sx), sy);
  };
}

function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n;
}

// ---------------------------------------------------------------------------
// Holographic finishes
// ---------------------------------------------------------------------------

/** Silky rainbow film: diagonal spectral sweep + counter-diagonal sheen. */
function drawHoloRainbow(ctx: CanvasRenderingContext2D, t: number): void {
  const sat = lerp(6, 84, t);
  const light = 71;
  // Hue over u = (x+y) mod 512 with 2 full spectral cycles (integer → seam-free).
  const rgbLUT = new Uint8ClampedArray(SIZE * 3);
  for (let u = 0; u < SIZE; u++) {
    const hue = (u / SIZE) * 360 * 2;
    const [r, g, b] = hslToRgb(hue, sat, light);
    rgbLUT[u * 3] = r;
    rgbLUT[u * 3 + 1] = g;
    rgbLUT[u * 3 + 2] = b;
  }
  // Brightness bands over v = (x−y) mod 512, 6 + 2 integer cycles.
  const amp = lerp(3, 22, t);
  const bandLUT = new Float64Array(SIZE);
  for (let v = 0; v < SIZE; v++) {
    bandLUT[v] =
      amp * Math.sin((TAU * 6 * v) / SIZE) + amp * 0.5 * Math.sin((TAU * 2 * v) / SIZE + 1.3);
  }
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = ((x + y) & (SIZE - 1)) * 3;
      const band = bandLUT[(x - y) & (SIZE - 1)] ?? 0;
      d[p] = (rgbLUT[u] ?? 0) + band;
      d[p + 1] = (rgbLUT[u + 1] ?? 0) + band;
      d[p + 2] = (rgbLUT[u + 2] ?? 0) + band;
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
}

interface TriangulationConfig {
  seed: number;
  /** Cells per side. The border ring re-draws wrapped cells, so any n works. */
  n: number;
  /** Max vertex jitter in px (keep < cell/2 so facets stay convex-ish). */
  jitter: number;
  background: string;
  border: string;
  borderWidth: number;
  facetFill: (wi: number, wj: number, tri: number, r1: number, r2: number) => string;
}

/**
 * Shared facet engine for holo-prism / holo-shatter. Vertex jitter and facet
 * colors are keyed to wrapped lattice indices, and the loop walks one extra
 * ring of cells (i, j ∈ −1..n) so facets that straddle an edge are drawn
 * again shifted ±512 — pixel-identical wrap copies.
 */
function drawTriangulation(ctx: CanvasRenderingContext2D, cfg: TriangulationConfig): void {
  const { seed, n, jitter } = cfg;
  const rand = mulberry32(seed);
  const cell = SIZE / n;
  const jx = new Float64Array(n * n);
  const jy = new Float64Array(n * n);
  for (let k = 0; k < n * n; k++) {
    jx[k] = (rand() - 0.5) * 2 * jitter;
    jy[k] = (rand() - 0.5) * 2 * jitter;
  }
  const vx = (a: number, b: number): number =>
    a * cell + (jx[wrapIndex(b, n) * n + wrapIndex(a, n)] ?? 0);
  const vy = (a: number, b: number): number =>
    b * cell + (jy[wrapIndex(b, n) * n + wrapIndex(a, n)] ?? 0);

  ctx.fillStyle = cfg.background;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineJoin = "round";
  ctx.lineWidth = cfg.borderWidth;
  ctx.strokeStyle = cfg.border;

  for (let j = -1; j <= n; j++) {
    for (let i = -1; i <= n; i++) {
      const wi = wrapIndex(i, n);
      const wj = wrapIndex(j, n);
      const x00 = vx(i, j);
      const y00 = vy(i, j);
      const x10 = vx(i + 1, j);
      const y10 = vy(i + 1, j);
      const x01 = vx(i, j + 1);
      const y01 = vy(i, j + 1);
      const x11 = vx(i + 1, j + 1);
      const y11 = vy(i + 1, j + 1);
      const paint = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        cx: number,
        cy: number,
        tri: number,
      ): void => {
        const r1 = hash2(seed ^ 0x51ed, wi * 2 + tri, wj);
        const r2 = hash2(seed ^ 0x2b7e, wi * 2 + tri, wj);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fillStyle = cfg.facetFill(wi, wj, tri, r1, r2);
        ctx.fill();
        ctx.stroke();
      };
      // Split direction keyed to WRAPPED parity so edge copies match exactly.
      if ((wi + wj) % 2 === 0) {
        paint(x00, y00, x10, y10, x11, y11, 0);
        paint(x00, y00, x11, y11, x01, y01, 1);
      } else {
        paint(x00, y00, x10, y10, x01, y01, 0);
        paint(x10, y10, x11, y11, x01, y01, 1);
      }
    }
  }
}

/** Faceted prisms: 8×8 jittered cells → 128 small facets, hue drifts diagonally. */
function drawHoloPrism(ctx: CanvasRenderingContext2D, t: number): void {
  const n = 8;
  drawTriangulation(ctx, {
    seed: SEEDS.prism,
    n,
    jitter: 22,
    background: "#e4e6ea",
    border: `rgba(255, 255, 255, ${lerp(0.12, 0.4, t).toFixed(3)})`,
    borderWidth: 1,
    facetFill: (wi, wj, tri, r1, r2) => {
      const hue = ((wi + wj) / n) * 360 + (r1 - 0.5) * 90 + tri * 14;
      const light = 68 + (r2 - 0.5) * lerp(4, 18, t);
      return hsl(hue, lerp(7, 76, t), light);
    },
  });
}

/** Flowing spectral ribbons: 8 vertical wave cycles, hue follows phase. */
function drawHoloWave(ctx: CanvasRenderingContext2D, t: number): void {
  const waves = 8; // integer vertical cycles → top/bottom edges match
  const sat = lerp(8, 80, t);
  const baseLight = 67;
  const steps = 1024;
  const hueLUT = new Uint8ClampedArray(steps * 3);
  const brLUT = new Float64Array(steps);
  const brAmp = lerp(2, 16, t);
  for (let i = 0; i < steps; i++) {
    const [r, g, b] = hslToRgb((i / steps) * 360, sat, baseLight);
    hueLUT[i * 3] = r;
    hueLUT[i * 3 + 1] = g;
    hueLUT[i * 3 + 2] = b;
    brLUT[i] = brAmp * Math.sin((TAU * i) / steps);
  }
  // Horizontal wobble with integer cycle counts (2 and 4) → left/right match.
  const wob = new Float64Array(SIZE);
  for (let x = 0; x < SIZE; x++) {
    wob[x] =
      0.42 * Math.sin((TAU * 2 * x) / SIZE + 0.9) + 0.08 * Math.sin((TAU * 4 * x) / SIZE + 2.0);
  }
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    const vRow = (y / SIZE) * waves;
    for (let x = 0; x < SIZE; x++) {
      const v = vRow + (wob[x] ?? 0);
      const f = v - Math.floor(v);
      const idx = (f * steps) | 0;
      const q = idx * 3;
      const br = brLUT[idx] ?? 0;
      d[p] = (hueLUT[q] ?? 0) + br;
      d[p + 1] = (hueLUT[q + 1] ?? 0) + br;
      d[p + 2] = (hueLUT[q + 2] ?? 0) + br;
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Hex-packed diffraction dots on near-white silver, hue hashed per dot. */
function drawHoloDots(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.fillStyle = "#eef0f3";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const pitch = 16; // divides 512 → the lattice itself wraps
  const cols = SIZE / pitch;
  const rows = SIZE / pitch; // even row count keeps the offset parity seamless
  const r = 6.4;
  const sat = lerp(8, 78, t);
  const alpha = lerp(0.35, 0.95, t);
  for (let j = 0; j < rows; j++) {
    const cy = j * pitch + pitch / 2;
    const xoff = (j % 2) * (pitch / 2);
    for (let i = 0; i < cols; i++) {
      const cx = i * pitch + pitch / 2 + xoff;
      const hue = hash2(SEEDS.dots, i, j) * 360;
      const light = 74 + (hash2(SEEDS.dots ^ 0xabc, i, j) - 0.5) * 10;
      for (const [dx, dy] of wrapOffsets(cx, cy, r + 1)) {
        const g = ctx.createRadialGradient(
          cx + dx - r * 0.25,
          cy + dy - r * 0.25,
          r * 0.1,
          cx + dx,
          cy + dy,
          r,
        );
        g.addColorStop(0, hsl(hue, sat, light + 9, alpha));
        g.addColorStop(0.55, hsl(hue, sat, light, alpha * 0.8));
        g.addColorStop(1, hsl(hue, sat * 0.9, light, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, TAU);
        ctx.fill();
      }
    }
  }
}

/** Angular iridescent shards: 6×6 coarse cells → 72 facets, dark fractures. */
function drawHoloShatter(ctx: CanvasRenderingContext2D, t: number): void {
  drawTriangulation(ctx, {
    seed: SEEDS.shatter,
    n: 6,
    jitter: 30,
    background: "#23252d",
    border: `rgba(15, 17, 26, ${lerp(0.25, 0.6, t).toFixed(3)})`,
    borderWidth: 1.5,
    facetFill: (wi, wj, tri, r1, r2) => {
      const hue = r1 * 360; // fully random hue → strong neighbor variance
      const light = 58 + (r2 - 0.5) * lerp(8, 30, t);
      return hsl(hue, lerp(8, 70, t), light);
    },
  });
}

// ---------------------------------------------------------------------------
// Foils and metals
// ---------------------------------------------------------------------------

/**
 * Rolled-foil look shared by gold/silver/rose: diagonal sheen (integer-cycle
 * sine over x+y, faint cross-sheen over x−y), per-row micro-grain, and three
 * large soft blotches drawn at all nine wrap offsets.
 */
function makeFoil(
  seed: number,
  base: readonly [number, number, number],
  shadow: readonly [number, number, number],
): (ctx: CanvasRenderingContext2D, t: number) => void {
  return (ctx, t) => {
    const rand = mulberry32(seed);
    const phase1 = rand() * TAU;
    const phase2 = rand() * TAU;
    const phase3 = rand() * TAU;
    const sheenAmp = lerp(5, 30, t);
    const grainAmp = lerp(2.5, 8, t);
    const sheen = new Float64Array(SIZE);
    const cross = new Float64Array(SIZE);
    for (let u = 0; u < SIZE; u++) {
      sheen[u] =
        sheenAmp * Math.sin((TAU * u) / SIZE + phase1) +
        sheenAmp * 0.45 * Math.sin((TAU * 2 * u) / SIZE + phase2);
      cross[u] = sheenAmp * 0.22 * Math.sin((TAU * u) / SIZE + phase3);
    }
    const rowDelta = new Float64Array(SIZE);
    for (let y = 0; y < SIZE; y++) {
      rowDelta[y] = (rand() - 0.5) * 2 * grainAmp + (rand() < 0.04 ? grainAmp * 1.8 : 0);
    }
    const img = ctx.createImageData(SIZE, SIZE);
    const d = img.data;
    let p = 0;
    for (let y = 0; y < SIZE; y++) {
      const row = rowDelta[y] ?? 0;
      for (let x = 0; x < SIZE; x++) {
        const v = (sheen[(x + y) & (SIZE - 1)] ?? 0) + (cross[(x - y) & (SIZE - 1)] ?? 0) + row;
        d[p] = base[0] + v;
        d[p + 1] = base[1] + v;
        d[p + 2] = base[2] + v * 0.92; // keep the warm/cool cast in highlights
        d[p + 3] = 255;
        p += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Low-frequency "rolled foil" blotches, wrapped across all nine offsets.
    const blotchAlpha = lerp(0.02, 0.1, t);
    for (let k = 0; k < 3; k++) {
      const bx = rand() * SIZE;
      const by = rand() * SIZE;
      const br = 170 + rand() * 110;
      const lightBlotch = k % 2 === 0;
      const rgb = lightBlotch ? "255, 255, 255" : `${shadow[0]}, ${shadow[1]}, ${shadow[2]}`;
      const a = lightBlotch ? blotchAlpha : blotchAlpha * 0.8;
      for (const dx of [-SIZE, 0, SIZE]) {
        for (const dy of [-SIZE, 0, SIZE]) {
          const gx = bx + dx;
          const gy = by + dy;
          if (gx + br < 0 || gx - br > SIZE || gy + br < 0 || gy - br > SIZE) continue;
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, br);
          g.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
          g.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(gx - br, gy - br, br * 2, br * 2);
        }
      }
    }
  };
}

/** Brushed aluminum: dense per-row grain with occasional bright strands. */
function drawMetalBrushed(ctx: CanvasRenderingContext2D, t: number): void {
  const rand = mulberry32(SEEDS.brushed);
  const base = 145;
  const sigma = lerp(2.5, 12, t);
  const strandBoost = lerp(4, 18, t);
  const rowDelta = new Float64Array(SIZE);
  for (let y = 0; y < SIZE; y++) {
    rowDelta[y] = gauss(rand) * sigma + (rand() < 0.05 ? strandBoost * rand() : 0);
  }
  // Low-frequency sheet waviness, integer cycles in both axes → seamless.
  const colMod = new Float64Array(SIZE);
  const rowSlow = new Float64Array(SIZE);
  const modAmp = lerp(1, 4.5, t);
  for (let i = 0; i < SIZE; i++) {
    colMod[i] =
      modAmp * (Math.sin((TAU * i) / SIZE + 0.7) + 0.5 * Math.sin((TAU * 3 * i) / SIZE + 2.2));
    rowSlow[i] = 2.2 * lerp(0.5, 1, t) * Math.sin((TAU * 2 * i) / SIZE + 1.1);
  }
  const jitterAmp = lerp(0.8, 3.5, t);
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    const row = base + (rowDelta[y] ?? 0) + (rowSlow[y] ?? 0);
    for (let x = 0; x < SIZE; x++) {
      const v = row + (colMod[x] ?? 0) + (rand() - 0.5) * 2 * jitterAmp;
      d[p] = v - 2;
      d[p + 1] = v;
      d[p + 2] = v + 3; // faint cool cast
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Brighter (and a few darker) strands; wrap in x when they cross the seam.
  const strands = Math.round(lerp(18, 70, t));
  for (let s = 0; s < strands; s++) {
    const y = Math.floor(rand() * SIZE);
    const x0 = rand() * SIZE;
    const len = 90 + rand() * 330;
    const a = 0.08 + rand() * 0.16;
    ctx.fillStyle =
      rand() < 0.3 ? `rgba(30, 32, 36, ${(a * 0.8).toFixed(3)})` : `rgba(255, 255, 255, ${a.toFixed(3)})`;
    ctx.fillRect(x0, y, len, 1);
    if (x0 + len > SIZE) ctx.fillRect(x0 - SIZE, y, len, 1);
  }
}

/** Chrome: soft-edged horizontal mirror bands, blue-tinted in the shadows. */
function drawMetalChrome(ctx: CanvasRenderingContext2D, t: number): void {
  const rand = mulberry32(SEEDS.chrome);
  const dark: readonly [number, number, number] = [43, 46, 51]; // #2b2e33
  const bright: readonly [number, number, number] = [238, 241, 245]; // #eef1f5
  const contrast = lerp(0.12, 1, t);
  const gain = 1.9;
  const norm = Math.tanh(gain * 1.4);
  const rowR = new Float64Array(SIZE);
  const rowG = new Float64Array(SIZE);
  const rowB = new Float64Array(SIZE);
  for (let y = 0; y < SIZE; y++) {
    const u = y / SIZE;
    // 3 primary + 1 secondary integer cycles → vertical wrap is exact.
    const s = Math.sin(TAU * 3 * u + 0.6) + 0.4 * Math.sin(TAU * u + 2.3);
    const shaped = Math.tanh(gain * s) / norm; // plateaus → mirror-band look
    const mix = 0.5 + 0.5 * shaped * contrast;
    const grain = (rand() - 0.5) * 2.5;
    rowR[y] = lerp(dark[0], bright[0], mix) + grain;
    rowG[y] = lerp(dark[1], bright[1], mix) + grain;
    rowB[y] = lerp(dark[2], bright[2], mix) + grain + (0.5 - Math.min(mix, 0.5)) * 24 * lerp(0.4, 1, t);
  }
  // Very subtle single-cycle horizontal sheen keeps rows from being sterile.
  const colWave = new Float64Array(SIZE);
  for (let x = 0; x < SIZE; x++) {
    colWave[x] = 1.5 * t * Math.sin((TAU * x) / SIZE + 1.0);
  }
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    const r = rowR[y] ?? 0;
    const g = rowG[y] ?? 0;
    const b = rowB[y] ?? 0;
    for (let x = 0; x < SIZE; x++) {
      const w = colWave[x] ?? 0;
      d[p] = r + w;
      d[p + 1] = g + w;
      d[p + 2] = b + w;
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

/** Multicolor glitter: thousands of rotated flecks + starburst catchlights. */
function drawGlitter(ctx: CanvasRenderingContext2D, t: number): void {
  const rand = mulberry32(SEEDS.glitter);
  // Mid-tone base with per-pixel shimmer noise.
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  let p = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const n = (rand() - 0.5) * 10;
    d[p] = 109 + n;
    d[p + 1] = 107 + n;
    d[p + 2] = 117 + n;
    d[p + 3] = 255;
    p += 4;
  }
  ctx.putImageData(img, 0, 0);
  // Flecks: 1–3 px rotated squares, wrap-copied near edges.
  const count = Math.round(lerp(250, 2800, t));
  const alphaScale = lerp(0.35, 1, t);
  for (let i = 0; i < count; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const size = 1 + rand() * 2;
    const rot = rand() * Math.PI;
    const white = rand() < 0.28;
    const a = (0.3 + rand() * 0.6) * alphaScale;
    const fill = white
      ? `rgba(255, 255, 255, ${a.toFixed(3)})`
      : hsl(rand() * 360, 65 + rand() * 25, 55 + rand() * 20, a);
    for (const [dx, dy] of wrapOffsets(x, y, size + 3)) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(rot);
      ctx.fillStyle = fill;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
  // A few larger 4-point star catchlights with a soft glow.
  const stars = Math.round(lerp(3, 12, t));
  for (let i = 0; i < stars; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const r = 2 + rand(); // star spans 4–6 px
    const rot = rand() * Math.PI;
    const a = (0.7 + rand() * 0.3) * alphaScale;
    const w = r * 0.22;
    for (const [dx, dy] of wrapOffsets(x, y, r * 2.6)) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(rot);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      glow.addColorStop(0, `rgba(255, 255, 255, ${(a * 0.55).toFixed(3)})`);
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(w, -w);
      ctx.lineTo(r, 0);
      ctx.lineTo(w, w);
      ctx.lineTo(0, r);
      ctx.lineTo(-w, w);
      ctx.lineTo(-r, 0);
      ctx.lineTo(-w, -w);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Kraft paper: warm brown, fiber noise, wrapped mottling, fiber flecks. */
function drawKraft(ctx: CanvasRenderingContext2D, t: number): void {
  const rand = mulberry32(SEEDS.kraft);
  const noiseBig = makeWrappedNoise(rand, 6);
  const noiseMid = makeWrappedNoise(rand, 17);
  const jitter = lerp(2, 6.5, t);
  const mottle = lerp(3, 10, t);
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const delta =
        (rand() - 0.5) * 2 * jitter +
        (noiseBig(x, y) - 0.5) * 2 * mottle +
        (noiseMid(x, y) - 0.5) * mottle;
      d[p] = 185 + delta * 1.15; // #b98f5f, warmer in the highlights
      d[p + 1] = 143 + delta;
      d[p + 2] = 95 + delta * 0.8;
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Short fiber strokes at random angles, wrap-copied near edges.
  const fibers = Math.round(lerp(160, 420, t));
  const alphaScale = lerp(0.7, 1, t);
  ctx.lineWidth = 0.8;
  ctx.lineCap = "round";
  for (let i = 0; i < fibers; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const ang = rand() * Math.PI;
    const len = 3 + rand() * 5;
    const ex = Math.cos(ang) * len;
    const ey = Math.sin(ang) * len;
    ctx.strokeStyle =
      rand() < 0.7
        ? `rgba(92, 62, 36, ${((0.1 + rand() * 0.18) * alphaScale).toFixed(3)})`
        : `rgba(236, 218, 190, ${((0.08 + rand() * 0.12) * alphaScale).toFixed(3)})`;
    for (const [dx, dy] of wrapOffsets(x, y, len + 3)) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx + ex, y + dy + ey);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Registry, cache, public API
// ---------------------------------------------------------------------------

type TileGenerator = (ctx: CanvasRenderingContext2D, intensity: number) => void;

const GENERATORS: Readonly<Record<string, TileGenerator>> = Object.freeze({
  "holo-rainbow": drawHoloRainbow,
  "holo-prism": drawHoloPrism,
  "holo-wave": drawHoloWave,
  "holo-dots": drawHoloDots,
  "holo-shatter": drawHoloShatter,
  "foil-gold": makeFoil(SEEDS.gold, [201, 162, 39], [110, 78, 18]),
  "foil-silver": makeFoil(SEEDS.silver, [201, 204, 210], [70, 76, 90]),
  "foil-rose": makeFoil(SEEDS.rose, [201, 132, 122], [118, 64, 58]),
  "metal-brushed": drawMetalBrushed,
  "metal-chrome": drawMetalChrome,
  glitter: drawGlitter,
  kraft: drawKraft,
});

/** Every finish id this engine can render (tests check catalog coverage). */
export const SUPPORTED_FINISH_IDS: readonly string[] = Object.freeze(Object.keys(GENERATORS));

const tileCache = new Map<string, HTMLCanvasElement>();

/**
 * Generate (or fetch from cache) the 512×512 seamless tile for a finish.
 * Returns null for unknown finish ids or when no DOM is available. If the
 * 2D context is unavailable (e.g. jsdom without node-canvas) a blank canvas
 * of the correct size is returned so callers never throw.
 */
export function generateFinishTile(
  finishId: string,
  options: FinishTileOptions,
): HTMLCanvasElement | null {
  const generator = GENERATORS[finishId];
  if (!generator || typeof document === "undefined") return null;
  const intensity = Number.isFinite(options.intensity) ? clamp01(options.intensity) : 0;
  const step = Math.round(intensity * 20); // quantize to the 0.05 cache grid
  const key = `${finishId}#${step}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = FINISH_TILE_SIZE_PX;
  canvas.height = FINISH_TILE_SIZE_PX;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (ctx) generator(ctx, step / 20);
  tileCache.set(key, canvas);
  return canvas;
}
