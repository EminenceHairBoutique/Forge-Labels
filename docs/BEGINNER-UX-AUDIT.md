# Beginner-UX audit — baseline before the Easy Creator overhaul

Audit date: 2026-07-13, at commit `a963528` (all M1–M7 + P1–P8 milestones
shipped). This document records what exists, what a beginner actually
experiences today, and the verified baseline the overhaul builds on.
The target architecture is in
[EASY-CREATOR-ARCHITECTURE.md](./EASY-CREATOR-ARCHITECTURE.md).

## Verified baseline (all green at audit time)

| Gate | Result |
| --- | --- |
| `npm run lint` | clean |
| `npm run typecheck` | clean (strict) |
| `npm test` | 26 files, 323 tests passing |
| `npm run build` | 45 routes, compiles clean |
| `npx playwright test` | full suite passing (see CI badge count) |

## 1. Current creation flow (the problem)

`/dashboard` → **New label** button → a single modal (`new-label-dialog.tsx`)
asking for: project name, a vial **Select** by preset name, a label-style
**Select** (`full-wrap`, `partial-wrap`… — jargon), and two **numeric mm
fields** (body diameter, straight wall) prefilled from the preset. A live
readout shows `74.0 × 26.0 mm · 2 mm bleed · 3 mm safe zone`.

Verdict for a beginner: the data model underneath is excellent (the
calculator computes everything), but the *surface* is expert-shaped:

- Vial choice is a text dropdown, not visual cards.
- "Body diameter" / "straight wall" / "bleed" / "safe zone" appear before
  the user has done anything.
- Creation lands directly in the **full canvas editor** — layers, transform
  handles, properties sidebar — with an empty white label.
- Materials (finishes/substrates) are discoverable only deep inside the
  properties panel's fill picker and background picker.
- Templates are a separate `/templates` gallery of flat thumbnails with
  category filters; applying one still lands in the canvas editor.
- No guided path connects vial → material → style → content → print.

## 2. Document schema (`src/lib/document/schema.ts`)

`LabelDocument` v1: `vial` (full physical spec), `label` (geometry incl.
bleed/safe/corner/shape), `background`, `substrateId`, `objects[]` (10-type
discriminated union). Positions are **mm, center-origin**; z-order is array
order; every mutation goes through the command bus; zundo gives gesture-
batched undo. **There is no notion of semantic roles** — a text object
doesn't know it's "the product name". This is the single schema gap for a
form-driven Easy mode; everything else the overhaul needs is present.
Migration chain exists (`migrate.ts`) and is the sanctioned way to add the
missing field.

## 3. Template system (`src/lib/templates/`)

16 templates = complete `LabelDocument`s authored per vial preset, with
`applyTemplate()` doing uniform proportional rescale about the label
center. Strengths: real documents, real fonts, validated, test-covered.
Gaps for the overhaul: (a) free-positioned objects only — no slots, so a
form can't target "brand" or "strength"; (b) uniform scaling letterboxes
rather than reflows when aspect ratios differ; (c) 16 total is far below a
template-led experience; (d) previews are flat rectangles, not vials.

## 4. Materials (`src/lib/finishes/`)

12 deterministic, seamlessly-tiling procedural finishes (5 holographic,
3 foils, 2 metals, glitter, kraft) usable as object fills AND backgrounds,
plus 6 substrates (white/clear/silver/holo/kraft/textured). Same tiles feed
editor and exports, so preview parity is structural. **This is the raw
material for §2 of the brief** — what's missing is a beginner-facing
"material" concept that bundles substrate + finish usage + design rules,
plus neon (which is a palette/artwork concept, not a finish — no new
pattern work needed) and gloss (a sheen simulation distinct from artwork
color).

## 5. Vial preview (`src/components/mockup/`)

A complete R3F scene (`vial-scene.tsx`): correct arc-length label wrap,
seam gap, glass tints, cap styles, liquid fill, live label texture from the
shared offscreen renderer, demand-driven frameloop, SVG fallback. Today it
is **modal-only** (`mockup-dialog.tsx`, opened from the editor top bar) —
the brief wants it to be the *centerpiece* of Easy mode. The scene is
reusable as-is; it needs a non-modal wrapper with simple view controls.

## 6. Mobile reality

Marketing pages, dashboard, and share pages are responsive. The editor
explicitly says "Advanced editing works best on desktop or tablet" on
small screens; the properties sidebar is hidden below `md`, so **on a phone
the editor is effectively view-only**. There is no mobile creation path.
No horizontal-overflow issues found on marketing/dashboard at 390 px width.

## 7. Anthropic integration (audited for §14)

Active and securely implemented (shipped in P7, commit `7d984a2`):
key-gated behind `ANTHROPIC_API_KEY`, server route owns key/system
prompt/tool defs, same-origin + cloud-auth + rate-limit + body-cap rails,
16 zod-validated typed tools over the command bus, one undo entry per
turn, document summarized (never sent raw), honest 503 gate without the
key, unit + route + e2e coverage with a mocked SDK. The brief's §14
requirements (schema validation, reversibility, no arbitrary code, works
without AI) are already satisfied by this design; Easy-mode surfacing can
build on it unchanged.

## 8. Reusable components inventory

- UI primitives: button, card, dialog, input, select, tabs, callout,
  toaster, skeleton, slider, switch, toggle-group, accordion, badge…
- `renderThumbnail` (offscreen raster at arbitrary px) for template/vial
  card imagery; finish tiles for material swatches.
- Label calculator (all six styles, pure + tested) for "help me choose".
- Export kernel: raster / print PDF / vector PDF / SVG / TIFF /
  separations / batch ZIP / imposition sheets — all reachable from any new
  export surface.
- Preflight rules with `ruleId`s — ready for a plain-language mapping
  layer.
- Entitlements resolver, storage adapters, autosave hook, undo store.

## 9. Marketing vs. implementation

Post-P8 sweep found no features claimed but missing. The gap runs the
other direction: the *experience* oversells complexity — a beginner landing
on the product hits professional software, while the marketing promises
"minutes to a professional label".

## 10. Conclusions driving the architecture

1. Nothing needs rebuilding; the beginner layer is additive.
2. One schema addition (semantic `slot` on objects + a small `easy` block
   on the document) unlocks form-driven editing while keeping ONE document
   model shared with the Advanced Editor. Bump `schemaVersion` → 2.
3. Easy templates must be **generated from slot-based layout definitions**
   (responsive by construction across 10/20/30 mL), not hand-authored
   documents — that's also the only honest path to a large, genuinely
   distinct template count.
4. Materials become a first-class beginner concept mapping onto existing
   substrates + finishes + palettes + design rules.
5. The vial scene moves from a modal to the center of the Easy flow.
6. Print simplification is a wizard + copy layer over existing exporters —
   no new export math.
