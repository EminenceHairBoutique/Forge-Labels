/**
 * Downloads the bundled label fonts as *static-weight* TTFs from the Google
 * Fonts API and writes public/fonts/manifest.json + LICENSES.md.
 *
 * Static instances (not variable fonts) are required: the PDF exporter embeds
 * these exact files via fontkit, which cannot instance a variable font — a
 * variable TTF would silently render its default weight in PDF viewers.
 *
 * Re-run with: node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openSync } from "fontkit";

// Legacy user agent → the CSS API responds with static truetype URLs.
const UA = "Mozilla/4.0";
const OUT_DIR = path.join(process.cwd(), "public", "fonts");

/** family: display name → { id, weights, category } */
const FAMILIES = [
  { id: "inter", name: "Inter", weights: [400, 500, 600, 700], category: "sans" },
  { id: "space-grotesk", name: "Space Grotesk", weights: [400, 500, 700], category: "sans" },
  { id: "montserrat", name: "Montserrat", weights: [400, 600, 800], category: "sans" },
  { id: "playfair-display", name: "Playfair Display", weights: [400, 600, 700], category: "serif" },
  { id: "cormorant-garamond", name: "Cormorant Garamond", weights: [400, 500, 600], category: "serif" },
  { id: "cinzel", name: "Cinzel", weights: [400, 700], category: "display" },
  { id: "orbitron", name: "Orbitron", weights: [400, 700, 900], category: "display" },
  { id: "bebas-neue", name: "Bebas Neue", weights: [400], category: "display" },
  { id: "jetbrains-mono", name: "JetBrains Mono", weights: [400, 700], category: "mono" },
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

const manifest = [];
const licenses = [];

await mkdir(OUT_DIR, { recursive: true });

for (const fam of FAMILIES) {
  const css = await fetchCss(fam.name, fam.weights);
  const faces = parseFaces(css);
  const files = [];
  for (const weight of fam.weights) {
    const face = faces.find((f) => f.weight === weight);
    if (!face) throw new Error(`No static TTF for ${fam.name} ${weight}`);
    const res = await fetch(face.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`TTF fetch failed: ${face.url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const file = `${fam.id}-${weight}.ttf`;
    await writeFile(path.join(OUT_DIR, file), buf);
    files.push({ weight, file, bytes: buf.length });
    console.log(`${fam.name} ${weight} → ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  manifest.push({ id: fam.id, name: fam.name, category: fam.category, files });

  // Read copyright/license metadata straight from the first font file.
  const font = openSync(path.join(OUT_DIR, files[0].file));
  licenses.push({ name: fam.name, copyright: font.copyright ?? "(no copyright record)" });
}

await writeFile(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);

const licenseMd = `# Bundled font licenses

All fonts bundled in this directory are licensed under the SIL Open Font
License, Version 1.1 (OFL-1.1), and were obtained from Google Fonts as
static-weight TrueType instances. The full OFL-1.1 text is available at
<https://openfontlicense.org> and in each family's upstream repository.

| Family | Copyright |
| --- | --- |
${licenses.map((l) => `| ${l.name} | ${l.copyright.replaceAll("|", "\\|")} |`).join("\n")}

These fonts are distributed with this application under the terms of the OFL.
The OFL permits bundling, redistribution, and commercial use, but the fonts
themselves cannot be sold standalone.
`;
await writeFile(path.join(OUT_DIR, "LICENSES.md"), licenseMd);

console.log(`\nWrote manifest.json + LICENSES.md for ${manifest.length} families.`);
