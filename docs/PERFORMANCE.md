# Performance report — template & typography overhaul

What §22 of the overhaul brief required, what shipped, and the honest
numbers behind it. Baselines are from the pre-overhaul build (commit
`dc129da`); measurements are from the production build on this branch.

## Fonts

- **Payload:** 38 families / 85 static TTF files / **9.3 MB on disk**
  (up from 10 families / 3.7 MB). This number is the DISK total, not a
  page cost: **nothing loads at startup**.
- **Lazy loading:** `src/lib/fonts/registry.ts` registers a `FontFace`
  only when a document, template preview, or pairing chip actually needs
  that family+weight, with a module-level promise cache (each file is
  fetched at most once per session). A typical Easy session touches one
  pairing ≈ 2–4 files ≈ 150–500 KB.
- **Preloading:** `ensureEasyFonts` loads every declared weight of a
  template's pairing before the engine measures — metrics never shift
  after the fact, so there are no font-swap layout shifts on the label
  itself.
- **Export blocking:** every export path (`raster.ts`,
  `pdf-vector-export.ts`, SVG's `FontStore`) awaits font readiness
  before rendering — a silent fallback-font export is not possible.
- **Validation:** `registry.test.ts` fails the build on missing files,
  byte drift, orphans, variable fonts, or missing glyphs.

## Template browser (153 cards)

- **Real previews, once:** cards render through the actual layout engine
  + export renderer into data URLs, cached in a module LRU (240 entries)
  keyed by template/palette/material/size/words — reopening the browser
  is instant, and a preview is never computed twice.
- **Laziness:** thumbnails render only when scrolled near the viewport
  (IntersectionObserver, 200 px margin); sections use
  `content-visibility: auto` so offscreen categories cost nothing to
  lay out.
- **One 3D scene:** cards are flat renders; the interactive Three.js
  preview exists only in the detail dialog (§15) — never 120 WebGL
  contexts.

## Engine

- The validation matrix (153 templates × their size/content/material
  cases, including the research stress scenarios — several thousand
  engine runs with the approximate measurer) completes in **a few
  seconds** in the unit suite — the engine itself is pure
  math and stays instant in the editor (real-metrics builds are a few
  milliseconds each, debounced at 350 ms while typing).

## Guarantees preserved

- Unit suite: 414 tests across 29 files. Full e2e: the Easy, overhaul,
  and research flows plus the pre-existing dimensional, parity, and perf
  specs — DPI-exact exports and editor↔export pixel parity are untouched.
- The production build emits the Easy editor and browser as
  client-side islands; the 9.3 MB font directory is static content
  served per-file on demand, not part of any JS bundle.

## Thumbnail cache

Template-browser and wizard previews are memoized twice: an in-session
promise cache, backed by IndexedDB (`fl-thumbs`, `src/lib/export/thumb-cache.ts`).
The persistent key is a hash of the BUILT document (object ids stripped)
plus the raster size — template redesigns change the doc and therefore
self-invalidate; nothing needs a version bump. Entries are LRU-pruned at
400. A cache hit skips font loading and Konva entirely, so a revisited
browser paints from disk.
