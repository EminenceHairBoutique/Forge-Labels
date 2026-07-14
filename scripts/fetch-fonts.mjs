/**
 * Downloads the bundled label fonts as *static-weight* TTFs from the Google
 * Fonts API and writes public/fonts/manifest.json + LICENSES.md.
 *
 * Static instances (not variable fonts) are required: the SVG and hybrid
 * vector PDF exporters outline glyphs from these exact files via fontkit,
 * which cannot instance a variable font — a variable TTF would silently
 * render its default weight.
 *
 * License policy: only OFL/Apache/UFL families are accepted. The license id
 * is read from each family's METADATA.pb in the google/fonts repository and
 * the copyright line from the font's own name table — both are recorded in
 * LICENSES.md.
 *
 * Idempotent: files already on disk are kept (pass --force to re-download).
 * Re-run with: node scripts/fetch-fonts.mjs
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { openSync } from "fontkit";

// Legacy user agent → the CSS API responds with static truetype URLs.
const UA = "Mozilla/4.0";
const OUT_DIR = path.join(process.cwd(), "public", "fonts");
const FORCE = process.argv.includes("--force");

/** family: display name → { id, weights, category } */
const FAMILIES = [
  // --- Original library ------------------------------------------------------
  { id: "inter", name: "Inter", weights: [400, 500, 600, 700], category: "sans" },
  { id: "space-grotesk", name: "Space Grotesk", weights: [400, 500, 700], category: "sans" },
  { id: "montserrat", name: "Montserrat", weights: [400, 600, 800], category: "sans" },
  { id: "playfair-display", name: "Playfair Display", weights: [400, 600, 700], category: "serif" },
  { id: "cormorant-garamond", name: "Cormorant Garamond", weights: [400, 500, 600], category: "serif" },
  { id: "cinzel", name: "Cinzel", weights: [400, 700], category: "display" },
  { id: "orbitron", name: "Orbitron", weights: [400, 700, 900], category: "display" },
  { id: "bebas-neue", name: "Bebas Neue", weights: [400], category: "display" },
  { id: "jetbrains-mono", name: "JetBrains Mono", weights: [400, 700], category: "mono" },
  // --- Modern sans -----------------------------------------------------------
  { id: "manrope", name: "Manrope", weights: [400, 600, 800], category: "sans" },
  { id: "plus-jakarta-sans", name: "Plus Jakarta Sans", weights: [400, 600, 700], category: "sans" },
  { id: "dm-sans", name: "DM Sans", weights: [400, 500, 700], category: "sans" },
  { id: "sora", name: "Sora", weights: [400, 600], category: "sans" },
  { id: "archivo", name: "Archivo", weights: [400, 600, 800], category: "sans" },
  { id: "work-sans", name: "Work Sans", weights: [400, 500, 600], category: "sans" },
  // --- Friendly / organic ------------------------------------------------------
  { id: "nunito-sans", name: "Nunito Sans", weights: [400, 600, 700], category: "sans" },
  { id: "quicksand", name: "Quicksand", weights: [400, 600], category: "sans" },
  { id: "raleway", name: "Raleway", weights: [400, 500, 700], category: "sans" },
  // --- Serif / luxury -----------------------------------------------------------
  { id: "bodoni-moda", name: "Bodoni Moda", weights: [400, 600, 700], category: "serif" },
  { id: "libre-baskerville", name: "Libre Baskerville", weights: [400, 700], category: "serif" },
  { id: "prata", name: "Prata", weights: [400], category: "serif" },
  { id: "marcellus", name: "Marcellus", weights: [400], category: "serif" },
  { id: "fraunces", name: "Fraunces", weights: [400, 600], category: "serif" },
  { id: "lora", name: "Lora", weights: [400, 600], category: "serif" },
  { id: "instrument-serif", name: "Instrument Serif", weights: [400], category: "serif" },
  // --- Condensed / bold ----------------------------------------------------------
  { id: "anton", name: "Anton", weights: [400], category: "display" },
  { id: "oswald", name: "Oswald", weights: [400, 600], category: "display" },
  { id: "archivo-narrow", name: "Archivo Narrow", weights: [400, 700], category: "display" },
  { id: "barlow-condensed", name: "Barlow Condensed", weights: [400, 600], category: "display" },
  { id: "league-spartan", name: "League Spartan", weights: [400, 700], category: "display" },
  // --- Technical / futuristic -----------------------------------------------------
  { id: "exo-2", name: "Exo 2", weights: [400, 700], category: "sans" },
  { id: "rajdhani", name: "Rajdhani", weights: [400, 600, 700], category: "display" },
  { id: "chakra-petch", name: "Chakra Petch", weights: [400, 700], category: "display" },
  { id: "oxanium", name: "Oxanium", weights: [400, 700], category: "display" },
  { id: "michroma", name: "Michroma", weights: [400], category: "display" },
  { id: "audiowide", name: "Audiowide", weights: [400], category: "display" },
  { id: "space-mono", name: "Space Mono", weights: [400, 700], category: "mono" },
  { id: "ibm-plex-mono", name: "IBM Plex Mono", weights: [400, 600], category: "mono" },
];

async function fetchCss(name, weights) {
  const family = `${name.replaceAll(" ", "+")}:wght@${weights.join(";")}`;
  const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`CSS fetch failed for ${name}: ${res.status}`);
  return res.text();
}

function parseFaces(css) {
  const faces = [];
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  for (const block of blocks) {
    const weight = Number(/font-weight:\s*(\d+)/.exec(block)?.[1]);
    const url = /src:\s*url\((https:[^)]+\.ttf)\)/.exec(block)?.[1];
    if (weight && url) faces.push({ weight, url });
  }
  return faces;
}

/** License id from the family's METADATA.pb in google/fonts. */
async function upstreamLicense(name) {
  const dir = name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  for (const tree of ["ofl", "apache", "ufl"]) {
    const url = `https://raw.githubusercontent.com/google/fonts/main/${tree}/${dir}/METADATA.pb`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const pb = await res.text();
    return /license:\s*"([^"]+)"/.exec(pb)?.[1] ?? tree.toUpperCase();
  }
  throw new Error(`No METADATA.pb found for ${name} — cannot verify license`);
}

function isTrueType(buf) {
  const tag = buf.readUInt32BE(0);
  return tag === 0x00010000 || tag === 0x74727565;
}

const manifest = [];
const licenses = [];
let downloaded = 0;
let kept = 0;

await mkdir(OUT_DIR, { recursive: true });

for (const fam of FAMILIES) {
  const license = await upstreamLicense(fam.name);
  if (!/^(OFL|APACHE2|UFL)$/i.test(license)) {
    throw new Error(`${fam.name}: unexpected license "${license}" — refusing to bundle`);
  }

  let faces = null;
  const files = [];
  for (const weight of fam.weights) {
    const file = `${fam.id}-${weight}.ttf`;
    const dest = path.join(OUT_DIR, file);
    const existing = await stat(dest).catch(() => null);
    if (existing && existing.size > 0 && !FORCE) {
      files.push({ weight, file, bytes: existing.size });
      kept += 1;
      continue;
    }
    if (!faces) {
      const css = await fetchCss(fam.name, fam.weights);
      faces = parseFaces(css);
    }
    const face = faces.find((f) => f.weight === weight);
    if (!face) throw new Error(`No static TTF for ${fam.name} ${weight}`);
    const res = await fetch(face.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`TTF fetch failed: ${face.url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isTrueType(buf)) throw new Error(`${fam.name} ${weight}: not a TrueType file`);
    await writeFile(dest, buf);
    files.push({ weight, file, bytes: buf.length });
    downloaded += 1;
    console.log(`${fam.name} ${weight} → ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  manifest.push({ id: fam.id, name: fam.name, category: fam.category, files });

  // Copyright straight from the font's own name table; license from upstream.
  const font = openSync(path.join(OUT_DIR, files[0].file));
  licenses.push({
    name: fam.name,
    license: license.toUpperCase() === "OFL" ? "OFL-1.1" : license,
    copyright: font.copyright ?? "(no copyright record)",
  });
}

await writeFile(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);

const totalBytes = manifest.flatMap((f) => f.files).reduce((s, f) => s + f.bytes, 0);
const licenseMd = `# Bundled font licenses

All fonts bundled in this directory were obtained from Google Fonts as
static-weight TrueType instances. The license id below is recorded from each
family's upstream METADATA.pb in the
[google/fonts](https://github.com/google/fonts) repository, and the copyright
line from the font's own name table. The full OFL-1.1 text is available at
<https://openfontlicense.org>. OFL and Apache-2.0 both permit bundling,
redistribution, and commercial use; OFL fonts cannot be sold standalone.

Regenerate this file, the manifest, and any missing font files with
\`node scripts/fetch-fonts.mjs\` (add \`--force\` to re-download everything).

| Family | License | Copyright |
| --- | --- | --- |
${licenses.map((l) => `| ${l.name} | ${l.license} | ${l.copyright.replaceAll("|", "\\|")} |`).join("\n")}

Total: ${manifest.length} families, ${manifest.flatMap((f) => f.files).length} files,
${(totalBytes / 1024 / 1024).toFixed(1)} MB. Fonts load lazily — only families
used by the open document or previewed template are fetched by the browser.
`;
await writeFile(path.join(OUT_DIR, "LICENSES.md"), licenseMd);

console.log(
  `\nWrote manifest.json + LICENSES.md: ${manifest.length} families (${downloaded} downloaded, ${kept} kept), ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`,
);
