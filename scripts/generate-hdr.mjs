/**
 * Generates public/env/studio.hdr — a synthetic studio-lighting environment
 * map (equirectangular, Radiance RGBE format, uncompressed scanlines).
 *
 * Layout: neutral graded ambient (darker floor, lighter ceiling) with three
 * soft-box area lights: a large key above-left, a cooler fill right, and a
 * narrow warm rim strip behind. Designed for MeshPhysicalMaterial
 * transmission (glass) — big soft gradients produce realistic reflections.
 *
 * Re-run with: node scripts/generate-hdr.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const W = 512;
const H = 256;

/** Soft rectangular light in panorama UV space (u,v in 0..1). */
function softbox(u, v, cu, cv, halfW, halfH, feather) {
  // Wrap-aware horizontal distance (the panorama seam joins u=0 and u=1).
  let du = Math.abs(u - cu);
  du = Math.min(du, 1 - du);
  const dv = Math.abs(v - cv);
  const fx = 1 - smoothstep(halfW, halfW + feather, du);
  const fy = 1 - smoothstep(halfH, halfH + feather, dv);
  return fx * fy;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function toRgbe(r, g, b) {
  const max = Math.max(r, g, b);
  if (max < 1e-32) return [0, 0, 0, 0];
  const e = Math.ceil(Math.log2(max));
  const scale = Math.pow(2, -e) * 256;
  return [
    Math.min(Math.floor(r * scale), 255),
    Math.min(Math.floor(g * scale), 255),
    Math.min(Math.floor(b * scale), 255),
    e + 128,
  ];
}

const pixels = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  const v = y / (H - 1); // 0 = zenith, 1 = nadir
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);

    // Ambient: bright ceiling fading to a dark floor, slightly warm.
    const ambient = 0.55 - 0.38 * v;
    let r = ambient * 1.02;
    let g = ambient;
    let b = ambient * 0.98;

    // Key softbox: large, above-left, neutral-warm, strong.
    const key = softbox(u, v, 0.18, 0.24, 0.1, 0.075, 0.09) * 11;
    r += key * 1.0;
    g += key * 0.98;
    b += key * 0.94;

    // Fill softbox: right side, cooler, gentler.
    const fill = softbox(u, v, 0.68, 0.38, 0.085, 0.11, 0.1) * 4.5;
    r += fill * 0.92;
    g += fill * 0.97;
    b += fill * 1.0;

    // Rim strip: tall narrow band behind (seam side), warm.
    const rim = softbox(u, v, 0.97, 0.42, 0.02, 0.2, 0.05) * 7;
    r += rim * 1.0;
    g += rim * 0.92;
    b += rim * 0.8;

    // Floor bounce: soft warm glow from below.
    const bounce = smoothstep(0.7, 1.0, v) * 0.12;
    r += bounce * 1.0;
    g += bounce * 0.95;
    b += bounce * 0.85;

    const [er, eg, eb, ee] = toRgbe(r, g, b);
    const i = (y * W + x) * 4;
    pixels[i] = er;
    pixels[i + 1] = eg;
    pixels[i + 2] = eb;
    pixels[i + 3] = ee;
  }
}

const header =
  `#?RADIANCE\n` +
  `# Synthetic studio softbox environment (Forge Labels, CC0)\n` +
  `FORMAT=32-bit_rle_rgbe\n\n` +
  `-Y ${H} +X ${W}\n`;

const out = Buffer.concat([Buffer.from(header, "ascii"), pixels]);
const dir = path.join(process.cwd(), "public", "env");
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "studio.hdr"), out);
console.log(`Wrote public/env/studio.hdr (${(out.length / 1024).toFixed(0)} KB, ${W}×${H})`);
