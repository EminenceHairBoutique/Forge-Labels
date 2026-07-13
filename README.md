# Forge Labels

The easiest way to make a professional vial label — and a full design studio
underneath. A guided **Easy Creator** takes a first-time user from "I have a
10 mL vial" to a print-correct label in about two minutes (choose a vial →
pick a material → answer a few questions → pick from designs made with your
own words), while the **Advanced Editor** offers complete canvas control.
Both edit the same document; switching modes never loses work.

## What it does

- **Easy Creator** (`/create`) — a visual wizard with no design jargon:
  vial cards drawn from real proportions, measure-with-a-string sizing,
  animated material cards (holographic, neon, glossy, plain, matte, clear,
  metallic, kraft), style questions, and 3–6 recommended designs rendered
  with your brand and product names already in place. The editor that
  follows is a simple form beside a live 3D vial: type and the label
  relays itself — auto-fit, reflow, contrast protection, and one-click
  fixes ("Fit everything", "Bigger product name", "Simplify") included.
  "Make my label for me" compresses the whole thing to one screen and
  three finished options.
- **Plain-language printing** — "How will you use your label?" produces a
  home-print sheet, a professional printer package (print-ready PDF +
  specification sheet), or a PNG, with print checks written for humans
  ("Your QR code is too small to scan reliably") and one-click fixes.
- **Matching product lines** — one dialog creates a sibling label that
  keeps the brand, fonts, material, and layout, changing only the product
  fields — with automatic strength color coding (5 mg blue, 10 mg purple…).
- **Vial-size calculator** — circumference = π × diameter, wrap width =
  circumference − gap, height bounded by the straight wall. Full-wrap,
  partial-wrap, front-only, front+back, neck-band, and cap-circle styles,
  with bleed, safe zone, and minimum-DPI guidance. (`/tools/label-calculator`)
- **Canvas editor** — text (weights, spacing, curved text, gradients),
  shapes, images (upload with SVG sanitization and filters), QR codes and
  barcodes (Code 128/39, EAN-13, UPC-A, DataMatrix) with scannability
  validation, layers, grouping, align/distribute, snapping with smart
  guides, rulers, bleed/trim/safe overlays, and gesture-batched undo/redo.
- **Simulated print finishes** — holographic, foil, brushed metal, glitter,
  and more as deterministic pattern tiles, identical on screen and in
  exports. Clearly labeled as simulations: physical foil differs.
- **3D mockup** — the design wrapped onto a glass vial at true scale
  (label arc length = physical width), with glass tints, caps, liquid fill,
  and PNG snapshots.
- **Print-ready output** — PNG/JPG at 300/600 DPI with embedded DPI
  metadata, true-vector SVG with text outlined to glyph paths, single-label
  PDFs with exact TrimBox/BleedBox and crop marks, imposed sheets
  (Letter/A4/Legal) with a printer-calibration page and saved X/Y offsets,
  and ZIP bundles. A preflight panel checks resolution, font sizes, safe
  zones, code scannability, and contrast before anything is exported.
- **Projects & brand kits** — autosave, version snapshots, thumbnails,
  tags, brand palettes/logos/fonts, and a template library of 16 fictional
  brand designs to start from.

## Quickstart (zero configuration)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables the app runs in
**local demo mode**: the full editor, exports, templates, and mockups work,
and projects persist in your browser (IndexedDB). A banner says so — nothing
is faked.

Adding Supabase keys enables accounts, cloud sync, and the admin dashboard;
adding Stripe keys enables subscriptions. Step-by-step: [docs/SETUP.md](docs/SETUP.md).

## Scripts

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Dev server (Turbopack)                          |
| `npm run build`     | Production build                                |
| `npm run start`     | Serve the production build                      |
| `npm run lint`      | ESLint                                          |
| `npm run typecheck` | `tsc --noEmit` (strict)                         |
| `npm test`          | Vitest unit suites (geometry, document, print…) |
| `npm run test:e2e`  | Playwright end-to-end suite                     |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, a
production build, and the Playwright suite on every push.

## Dimensional accuracy

Millimeters are the canonical unit everywhere; documents never store screen
pixels. One conversion kernel (`src/lib/geometry/units.ts`) feeds the editor
(screen px = mm × zoom), rasters (px = mm ÷ 25.4 × DPI, enforced exactly),
and PDFs (pt = mm × 72 ÷ 25.4). Exports are verified byte-level in CI: PNG
pixel counts and pHYs DPI chunks, PDF TrimBox values, SVG physical units —
plus a pixelmatch regression proving the editor canvas and exported PNG
render identically. Details: [docs/PRINT-ACCURACY.md](docs/PRINT-ACCURACY.md).

## Documentation

| Doc                                                        | Contents                                             |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| [docs/SETUP.md](docs/SETUP.md)                             | Supabase + Stripe configuration, admin grant, seeding |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                   | Deploying to Vercel (and any Node host)              |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)               | System design: document model, rendering, storage    |
| [docs/PRINT-ACCURACY.md](docs/PRINT-ACCURACY.md)           | Dimensional guarantees + pre-print checklist         |
| [docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) | Go-live checklist and security review              |
| [docs/ROADMAP.md](docs/ROADMAP.md)                         | Phased roadmap                                       |
| [docs/deferred.md](docs/deferred.md)                       | Honest ledger of intentionally deferred features     |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
react-konva/Konva (editor + exports) · zustand + zundo (state + undo) ·
Zod (document schema) · @cantoo/pdf-lib (PDF) · fontkit (SVG text outlining) ·
qrcode + bwip-js (codes) · three/@react-three/fiber (mockup) ·
Supabase (optional auth/DB/storage, RLS) · Stripe (optional billing) ·
Vitest + Playwright + fast-check.

## Repository layout

```
src/app/            (marketing) (auth) (studio) editor api routes
src/components/     editor, mockup, admin, auth, studio, marketing, ui
src/lib/            geometry document render export codes preflight
                    finishes print templates storage supabase stripe
src/stores/         document (undoable) · editor-ui · auth
supabase/           migrations (schema + RLS + seeds)
public/fonts        bundled OFL fonts (browser + PDF embedding)
tests/e2e           Playwright: exports, parity, modes, perf, a11y
docs/               setup, deployment, architecture, print accuracy…
```

## Disclaimers

Simulated finishes approximate physical materials; order a printed proof
before production runs. Label content compliance (FDA, cosmetic, and other
regulations) is the user's responsibility — see `/legal/regulatory` and
`/legal/print-accuracy` in the app. All template brands are fictional.
