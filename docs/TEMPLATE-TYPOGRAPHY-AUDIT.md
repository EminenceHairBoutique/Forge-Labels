# Template, typography, material & ease-of-use audit

Audit date: 2026-07-14 · Baseline commit: `dc129da` · Branch:
`claude/vial-label-designer-7vsqtp` (this IS the repository's default
branch — the remote HEAD — so the Vercel deployment at
forge-labels.vercel.app builds from exactly this branch).

Baseline verification on this commit: `npm install` (clean),
`npm run lint` ✓, `npm run typecheck` ✓, `npm test` 384/384 ✓,
`npm run build` ✓, `npx playwright test` 59/59 ✓ — no pre-existing
failures to record.

## Current strengths (preserve — do not rebuild)

- **One document model, two editors.** Easy Creator and the Advanced
  Editor edit the same mm-canonical document; slot objects
  (`obj.slot`, schema v2) are engine-owned and regenerate wholesale,
  free objects survive on top. Round-trips are lossless.
- **Layout programs, not frozen artboards.** Easy templates are
  size-responsive RowDef programs (`sizeFactor` of label height,
  `minPt` floors, `maxLines`, zone stacking, global squeeze) — the
  same template genuinely re-lays-out for 10/20/30 mL.
- **Exact print math.** DPI-exact PNG/PDF/SVG/TIFF exports with
  byte-level e2e assertions; preflight engine; imposition; separations;
  hybrid vector PDF. `tests/e2e/parity.spec.ts` pixel-matches editor vs
  export.
- **Material rules that protect readability**: coverage per intensity,
  automatic contrast panels on full-effect backgrounds, transparent
  substrates with white-ink notes.
- **28 curated palettes** with WCAG contrast guaranteed by construction
  (unit-tested ratios).
- **Font loading is already correct where it exists**: static-TTF
  manifest, lazy `FontFace` registration with cached promises, and
  every export path awaits `loadFontsForDocument`/`FontStore` before
  measuring or rendering — no silent-fallback exports today.
- Wizard, form editor, plain-language print flow, matching-label
  generator, onboarding, and a green 384-unit/59-e2e suite.

## Current template inventory

- **Easy templates: 12** layout archetypes in `src/lib/easy/templates.ts`
  (clinical-frame, luxury-center, bold-block, futuristic-band,
  minimal-left, botanical-soft, lab-mono, skincare-airy, premium-cinzel,
  type-stack, wellness-band, qr-forward). All declare `materials: "all"`.
- **Advanced templates: 16** complete documents in
  `src/lib/templates/data/` (a separate, non-responsive system used by
  the Advanced Editor's template dialog).
- Effective Easy variety today = 12 layouts × 8 materials × 28 palettes,
  but only 12 genuinely distinct grids — far short of the 120 distinct
  layouts this brief requires.

## Current font inventory

10 families / 24 static TTF weights (3.7 MB) in `public/fonts`, all
OFL-1.1, recorded in `public/fonts/LICENSES.md`:

| Family | Weights | Category |
| --- | --- | --- |
| Inter | 400/500/600/700 | sans |
| Space Grotesk | 400/500/700 | sans |
| Montserrat | 400/600/800 | sans |
| Playfair Display | 400/600/700 | serif |
| Cormorant Garamond | 400/500/600 | serif |
| Cinzel | 400/700 | display serif |
| Orbitron | 400/700/900 | display tech |
| Bebas Neue | 400 | display condensed |
| JetBrains Mono | 400/700 | mono |

## Current categories & repetitive patterns

- Vibe tags exist (clinical/luxury/bold/futuristic/minimal/botanical/
  playful/premium) but there is **no category[]/mood[]/density/colorMode
  metadata**, no families beyond a 1:1 `family` string, no
  premium/featured flags, no per-template material compatibility in
  practice (everything is `"all"`).
- **Repetition:** every template is a single centered/left column of
  stacked rows. All QR codes sit in a bottom corner; every brand row is
  a small caps line at the top; strength is always a colored text row.
  Differentiators the brief demands that no template uses today:
  multi-column grids, vertical/rotated type, monograms, strength
  badges/chips, side-mounted codes, dividers between specific rows,
  corner marks, inset panels, medallions.

## Missing template categories

Laboratory/research (beyond one mono template), glossy-specific,
beauty/skincare (one), transparent/frosted-specific (palettes only),
apothecary/heritage, and the entire named-family taxonomy (§5 of the
brief). No template declares recommended glass colors or content
density.

## Font-loading risks

1. `resolveWeight` silently maps a missing weight to the closest one —
   fine at runtime, but nothing VALIDATES that templates/pairings only
   reference bundled weights (a typo would ship). → automated manifest
   validation needed.
2. `loadFontsForDocument` catches per-font failures so the editor keeps
   working, but there is no surfaced signal of a missing font file.
3. The manifest is hand-maintained JSON; adding ~28 families by hand
   invites drift → needs a fetch script that regenerates manifest +
   license record from source metadata.
4. No preloading of a template's fonts when it is previewed in bulk
   (the 120-card browser would trigger 120 uncoordinated loads without
   a cache plan — mitigated by the existing promise cache, but preview
   rendering must still await readiness or thumbnails render fallback).

## Export compatibility risks

- SVG and hybrid-vector PDF **outline glyphs with fontkit from the same
  TTF files** (no font embedding) — every added font must be a static
  TTF instance that fontkit can parse; variable fonts with `[wght]`
  axes are NOT safe to drop in. The fetch script must download static
  instances (css2 API with a legacy UA yields per-weight static TTFs).
- Konva canvas + raster export use CSS `FontFace` — same files, loaded
  before render (`raster.ts:132,206`) — safe.
- The 3D preview textures from the same raster pipeline — safe.
- Risk: fonts with unusually tall ascenders (Fraunces, Bodoni Moda)
  change row heights; the engine measures real metrics so layout holds,
  but validation must run per-pairing so no template ships clipping at
  min sizes.

## Mobile usability problems (current)

- The mobile flow itself shipped and is e2e-tested (iPhone/iPad matrix);
  no horizontal overflow.
- But: recommendations show only 3–4 cards with no way to browse
  further on mobile; no bottom-sheet filter pattern exists; template
  choice beyond the recommendation set requires nothing today because
  there is nothing to browse — the browser must be designed
  mobile-first from the start.
- Reactive shine uses pointer/tilt with no `prefers-reduced-motion`
  gate (accessibility §23 gap).

## Beginner usability problems (current)

- The wizard never asks about information density, logo, QR, or barcode
  needs — so recommendations can't consider them (§7).
- Only 3–4 recommendations with generic tags ("More bold") and **no
  one-sentence reasons**.
- Typography is invisible (good default, but no "typography
  personality" choice and no "try another font pairing" — fonts are
  hard-wired per template).
- Logo: the `logo` slot is reserved but there is no upload path in Easy
  mode (deferred in the previous overhaul; this brief pulls it in).
- No template browser: "show me everything holographic" is impossible.
- Verification code / verification URL has no slot.
- No "make it more premium/cleaner/bolder/clinical/futuristic" actions;
  intensity is a control, not a one-click "increase effect" action.

## Incomplete or misleading functionality

- None found shipping fake UI — capability gating holds everywhere.
  The one honesty debt: `docs/deferred.md` reframed "110+ templates" as
  archetypes×materials×palettes; this brief explicitly rejects that
  framing, so the ledger entry must be replaced by a real 120-layout
  library.
- "Most popular" browsing (§14) cannot be honest without usage
  analytics, which don't exist — ship "Featured" (curated) and record
  the analytics dependency in deferred.md rather than fake popularity.

## Recommended architecture changes (the implementation plan)

1. **Fonts first** (everything depends on them): `scripts/fetch-fonts.mjs`
   downloads static TTF instances + upstream METADATA for ~28 new OFL
   families, regenerates `manifest.json` + `LICENSES.md`; add
   `validateFontManifest()` (files exist, weights resolve, every
   template/pairing reference resolves) wired into unit tests.
2. **Typography layer**: `FontPairing` registry (display/body/technical
   roles, tracking, uppercase roles, minimum print sizes) + 10
   personalities; templates reference `fontPairingId`; documents get an
   optional `easy.pairingId` override (schema v3).
3. **Template schema upgrade**: EnhancedTemplateMetadata merged into
   `EasyTemplateDef` (family/category[]/mood[]/vial+volume+material
   compat/glass colors/density/colorMode/pairing/difficulty/premium/
   featured); new slots `verification`, decorative slots stay engine
   pseudo-slots (`accent:*`) by design; RowDef gains priority,
   chips, monogram, columns; DecorDef gains corner marks, dividers,
   side rails, medallions, inset panels; new code placements (side
   rail); vertical/rotated brand rows; split-column layout mode.
4. **Validation harness** `src/lib/easy/validate.ts` + `npm run
   validate:templates`: every template × sizes × content scenarios ×
   QR/barcode/warning toggles, checking min font sizes, safe bounds,
   quiet zones, overlap, contrast, font references — actionable error
   strings; unit test asserts the whole registry is clean.
5. **Template families**: per-family data files under
   `src/lib/easy/templates/`; existing 12 keep their IDs (stored docs
   reference them). 30 flagships, then expand to 120+.
6. **Recommendations v2**: density/logo/QR/barcode/glass inputs, six
   labeled roles with one-sentence reasons; wizard gains a "what needs
   to fit" step and a glass-color question.
7. **Template browser**: mockup-first cards over the existing
   `renderThumbnail` with an LRU dataURL cache + IntersectionObserver
   laziness; favorites (localStorage); filters with a bottom sheet on
   mobile; one interactive 3D preview only in the detail view.
8. **Material placements**: effect placement modes for holographic
   (full/panel/band/border/title/accents) and neon looks with automatic
   readability protection; gloss stays a sheen + palette treatment
   (honest simulation).
9. **Logo upload in Easy**: downscaled dataURL → image object in the
   reserved `logo` slot, engine-reserved header space.
10. **Accessibility & performance**: reduced-motion gates, thumbnail
    caching, `content-visibility` for the 120-card grid, no startup
    font loading (already true — keep it that way).

---

## Outcome (post-overhaul addendum)

Everything above shipped on this branch. Where the result differs from the
plan, the difference is noted:

- **Fonts:** 38 families / 85 static TTFs / 9.3 MB, license-verified from
  upstream METADATA (OFL/Apache/UFL only) with per-family copyright lines
  in `public/fonts/LICENSES.md`; `registry.test.ts` gates manifest ↔ disk
  parity, byte drift, variable-font rejection, and glyph coverage.
- **Typography:** 27 pairings / 10 personalities in
  `src/lib/easy/typography.ts`; `easy.pairingId` override landed in
  schema v3 exactly as planned.
- **Templates:** 120 registered and validated (min counts of the brief
  all exceeded), 116 distinct families, layout-DNA uniqueness enforced in
  the unit suite. The 12 legacy archetypes kept their IDs.
- **Validation:** the harness became the centerpiece — it surfaced ~15
  real engine defects (aligned-anchor contrast sampling, code-corner fit
  budgets, panel clamping, wrap-nonlinearity in squeeze) that were fixed
  in `instantiate.ts` rather than waived in the gate. 0 errors across
  ~3,300 build cases at ship time.
- **Recommendations/browser/logo/placements:** shipped as specified
  (six labeled roles with reasons; LRU + IntersectionObserver browser at
  `/library` and in-editor; PNG/JPG logo with SVG deferred to the
  Advanced Editor; effect placements with automatic readability
  protection).
- **Deliberate deviations:** decorative elements remained engine
  pseudo-slots (`accent:*`) per the original design note; "Most popular"
  stayed out (no analytics — see deferred.md); gloss remains a labeled
  sheen simulation rather than a fake artwork effect.

Reports: [PERFORMANCE.md](./PERFORMANCE.md) ·
[ACCESSIBILITY.md](./ACCESSIBILITY.md) · user-facing summary in
[ROADMAP.md](./ROADMAP.md).
