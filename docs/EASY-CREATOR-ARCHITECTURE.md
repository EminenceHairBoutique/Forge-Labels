# Easy Creator — beginner UX architecture

The design for the beginner-first overhaul. Baseline findings:
[BEGINNER-UX-AUDIT.md](./BEGINNER-UX-AUDIT.md). Ground rule (§21 of the
brief): **one document model**. Easy Creator and the Advanced Editor edit
the same `LabelDocument` through the same command bus; a project moves
between modes without conversion or loss.

## 1. Modes

- **Easy Creator** (default): guided wizard (`/create`) → form-based editor
  with the vial preview as the centerpiece (`/easy/[id]`). No canvas, no
  layers, no print jargon.
- **Advanced Editor** (existing, unchanged): `/editor/[id]`. Reached only
  via an explicit "Customize in Advanced Editor" action. Projects opened
  there show "Back to Easy Creator" when they carry Easy metadata.

## 2. Schema v2 (the one schema change)

> **Now v3.** The template/typography overhaul (§14 below) added three
> optional fields to `easy` — `pairingId` (font-pairing override),
> `placement` (effect placement), `logoAspect` — and a `verification`
> slot. `schemaVersion: 3`; the `2 → 3` migration is again a pure
> version stamp.

`schemaVersion: 2`, migration `1 → 2` is a version stamp (all additions
optional):

```ts
// on every object (baseObject):
slot?: string        // semantic role: "brand" | "product-name" | "strength" |
                     // "volume" | "subtitle" | "ingredients" | "directions" |
                     // "storage" | "warning" | "lot" | "expiry" | "website" |
                     // "qr" | "barcode" | "logo" | "accent-*" (decorative)

// on the document:
easy?: {
  templateId: string          // EasyTemplateDef id that generated the layout
  materialId: string          // beginner material (e.g. "holographic")
  materialOptionId: string    // sub-option (e.g. "rainbow-prism")
  intensity?: "subtle" | "balanced" | "bold" | "maximum"
  paletteId: string           // curated palette id
  styleId?: string            // style answer from the wizard
  /** Last values of hidden optional slots, so toggles restore text. */
  stash?: Record<string, string>
}
```

Content itself lives **in the slot objects** (single source of truth). The
Easy form reads/writes them via the command bus, so undo, autosave, parity,
and exports all work unchanged. Objects without `slot` are free objects —
anything the user adds in the Advanced Editor simply isn't form-editable,
but renders and exports normally. Deleting a slot object in Advanced mode
degrades gracefully: Easy shows the field as "off".

## 3. Module map (`src/lib/easy/`)

| Module | Responsibility |
| --- | --- |
| `slots.ts` | Slot ids, labels, form metadata (input kind, toggle group, placeholder), priority order — incl. `verification` (v3) |
| `materials.ts` | Beginner materials (holographic/neon/glossy/plain/matte/clear/metallic/kraft) + sub-options → `{ substrateId, finishId?, palettes, rules, plain descriptions }`; `EffectPlacement` + `placementChoices()` (v3) |
| `palettes.ts` | Curated palettes per material/style with guaranteed text contrast; optional `border`/`qrColor`/`glass` fields (v3) |
| `templates/` | 120 template definitions across 9 files (see §14): rows/zones/decor programs with per-slot constraints, `EnhancedTemplateMetadata`, families |
| `typography.ts` | (v3) 27 `FontPairing`s (display/body/technical roles, weight ladders, tracking, uppercase roles, minimum print sizes) + 10 plain-language personalities |
| `instantiate.ts` | `buildEasyLabel(input) → { objects, background, notes, hiddenSlots }` — the layout engine; responsive across 10/20/30 mL and edge shapes by construction |
| `layout.ts` | Auto-fit font sizing, line clamping, vertical reflow, hide-when-empty collapse, overlap prevention (pure; text measurer injectable for node tests) |
| `fields.ts` | Read current field values from a doc; write via commands (one gesture per form edit); toggle slots on/off with `easy.stash`; `ensureEasyFonts` preloads a pairing's weights |
| `recommend.ts` | Wizard answers → six labeled picks (Best match / Most professional / Most minimal / Most bold / Most premium / Alternative style) with one-sentence reasons |
| `variations.ts` | One-click controlled variations (palette shifts, layout swaps, dark/light, density) — all undoable |
| `validate.ts` | (v3) The template quality gate: sizes × content scenarios × material cases → print floors, overlap, quiet zones, contrast vs actual backing, hierarchy, font references (`npm run validate:templates`) |
| `logo.ts` | (v3) `fileToEasyLogo` — PNG/JPG → downscaled data URL + aspect (SVG rejected with a pointer to the Advanced Editor) |
| `plain-preflight.ts` | Preflight `ruleId` → plain-language message + optional one-click fix command (incl. "Fix contrast") |
| `family.ts` | Matching product-line generator (preserve identity, change product fields; strength color coding) |
| `draft.ts` | Wizard draft persistence (localStorage) so refresh never loses progress |
| `spec-sheet.ts` | Printer specification summary (text + PDF page) |

## 4. Route map

| Route | Purpose |
| --- | --- |
| `/create` | Guided wizard: vial (+ glass color) → material → style → what-needs-to-fit → recommendations. Step in `?step=`; draft in localStorage. Mobile-first: one question per screen |
| `/easy/[id]` | Easy editor: content form + live vial preview + variations + plain-language export |
| `/editor/[id]` | Advanced Editor (existing) |
| `/dashboard` | Creation-first: big "Make a new label", recent labels as vial cards, "Create a matching label"; empty state asks "What would you like to make?" |
| `/library` | (v3) Full-page template browser over all 120 templates; picking one creates a project directly |
| `/templates` | Marketing gallery (Advanced-Editor brand templates); cards deep-link into the wizard |

## 5. Component architecture (`src/components/easy/`)

```
create-wizard.tsx        — step shell: progress, back, sticky Continue
  steps/vial-step.tsx    — visual vial cards + glass color + "know your measurements?" branch
  steps/material-step.tsx— material cards (animated) + sub-options + descriptions
  steps/style-step.tsx   — feel cards + optional brand questions
  steps/needs-step.tsx   — "what needs to fit?": content density + QR/barcode/logo switches
  steps/pick-step.tsx    — six labeled recommendations as vial mockups, with reasons
template-browser.tsx     — 120-card browser: lazy cached engine thumbnails,
                           favorites, filters (bottom sheet on phones),
                           detail view with the single 3D preview
easy-editor.tsx          — /easy/[id] shell (preview centerpiece + form)
  vial-stage.tsx         — non-modal wrapper around the existing R3F vial scene
                           (front/side/back, rotate, zoom, light/dark backdrop,
                           SVG fallback); flat-label secondary toggle
  content-form.tsx       — §3 fields bound to slots, live updates, toggles
  variation-row.tsx      — §5 one-click variations (carousel on mobile)
  material-picker.tsx    — change material after creation
  palette-row.tsx        — curated palette swatches (+ optional custom picker)
  export-wizard.tsx      — §10 "How will you use your label?"
  fix-list.tsx           — plain-language warnings with one-click fixes
onboarding.tsx           — §16 first-run 5-step overlay + sample project
```

Reused as-is: `vial-scene.tsx`, `renderThumbnail`, finish tiles, label
calculator, all exporters, preflight, storage adapters, autosave, undo.

## 6. Materials → existing systems

| Beginner material | Substrate | Finish usage | Notes |
| --- | --- | --- | --- |
| Holographic (6 sub-options) | `holo-pet` or `white-pp` | `holo-*` finish fills per intensity recipe (background / border / name / accents) | Contrast panels auto-inserted; "simulation only" stated |
| Neon (8 sub-options) | `white-pp` | none — fluorescent-look palettes + bold artwork | Copy clarifies neon ≠ light-emitting |
| Glossy (6 sub-options) | `white-pp` | sheen simulated in the vial preview only; artwork colors unchanged | "Finish ≠ design color" separation |
| Plain (9 sub-options) | `white-pp` / `textured-paper` | none | Professional-by-default templates |
| Matte / Soft-touch | `white-pp` | preview treatment | |
| Metallic (gold/silver/rose/brushed) | `silver-pet` | `foil-*`/`metal-*` accents | |
| Clear / Frosted | `clear-pp` | none | White-ink advisory in plain language |
| Kraft | `kraft-paper` | `kraft` texture shows through | |

Material rules (§6) live in `materials.ts` as data: required contrast
panels, allowed finish coverage per intensity, palette sets, and per-slot
overrides consumed by `instantiate.ts`.

## 7. Layout engine contract (§4)

For each slot the template defines: region (fractions of label + mm
clamps), alignment, priority, min/preferred font, max lines, collapse and
hide-when-empty flags. The engine guarantees, by construction:

- text never leaves the printable region (regions are inside the safe area;
  auto-fit shrinks to `minFontPt`, then truncates with a visible warning
  rather than overflowing);
- QR/barcode slots reserve quiet zones; nothing may overlap them (slots are
  disjoint regions);
- contrast is palette-guaranteed; custom colors pass a contrast check or
  get a protective panel;
- hidden slots reflow neighbors (stack collapse) — no empty gaps;
- every engine write is a normal command → undoable.

One-click fixes are re-runs of the engine with a directive ("fit all",
"balance", "simplify") — never destructive, always one undo step.

## 8. Recommendation logic (§ Step 3)

`recommendTemplates(options)` first filters by hard eligibility (material
compatibility, the template's minimum label dimensions vs the user's real
size), then scores: style/mood match, light/dark preference, content
density fit, QR/barcode needs (side placements and larger QR intents score
higher when codes matter), glass-color affinity, and a small featured
boost. Six roles are then cast from the ranked pool, one per template
family: **Best match** (top score), **Most professional**, **Most
minimal**, **Most bold**, **Most premium** (role-keyed re-sorts), and
**Alternative style** (a structurally different layout — different
alignment/split/decor signature). Each card carries
`recommendationReason()` — one sentence, at most two clauses, built from
the same signals that produced the score. Every card is a full vial
mockup rendered from the user's actual size, material, brand, and product
name via the engine + `renderThumbnail` + the vial scene.

## 9. Plain-language preflight map (§10, §17)

`plain-preflight.ts` maps every existing `ruleId` to beginner copy and,
where safe, a one-click fix:

| ruleId (existing) | Plain message | Fix |
| --- | --- | --- |
| safe-zone violation | "Some text is too close to the edge." | Nudge inside safe area |
| low image DPI | "This image may print blurry." | — (advice: upload larger) |
| QR module size | "Your QR code is too small to scan reliably." | Enlarge QR to minimum |
| white-ink-needed | "Light artwork can disappear on clear material unless the printer adds a white backing layer." | Switch to white material / add panel |
| contrast | "This text may be hard to read on that background." | Apply protected palette color |
| barcode invalid | "This barcode number isn't valid — check the digits." | — |

Advanced Editor keeps the technical wording; printer documents keep the
proper terms (§17).

## 10. Mobile interaction plan (§15)

- Wizard: one decision per screen, cards ≥ 88 px tall, sticky bottom
  Continue, browser-back = step back, draft autosaved each step.
- Easy editor on phones: vial preview docked at top (collapsible to a
  floating "Preview" button when the keyboard is open), form below,
  variations as a swipeable row, export as a bottom sheet.
- No hover requirements (holographic cards animate on touch/tilt with a
  motion-safe fallback), no drag interactions, no horizontal page scroll.
- Advanced Editor remains desktop-first — beginners never need it.

## 11. Data / backend changes

None required. No new tables; no Supabase migration (schema v2 is a client
document version handled by `migrate.ts`, and documents are stored as
JSON). Entitlements, sharing, teams, billing untouched.

## 12. Testing plan (§23)

New `tests/e2e/easy-creator.spec.ts` (+ mobile viewport variants) covering
the brief's 18 cases; unit suites for `layout.ts` (auto-fit, reflow,
collapse), `instantiate.ts` (slot generation across 10/20/30 mL),
`recommend.ts`, `plain-preflight.ts`, `family.ts`, and the v1→v2
migration. All existing dimensional/parity/export tests must stay green —
they are the guarantee that the beginner layer changed the surface, not
the physics.

## 13. Build order

Matches the brief's §24 phases: B1 architecture → B2 materials → B3 smart
content → B4 templates/variations/family → B5 print simplification →
B6 make-it-for-me + AI surfacing + full e2e matrix + docs. Each phase
lands with the full gate green and a commit.

---

## 14. Template & typography overhaul (v3 layer)

The second overhaul, built on top of everything above without touching the
print kernel. Before/after state: [TEMPLATE-TYPOGRAPHY-AUDIT.md](./TEMPLATE-TYPOGRAPHY-AUDIT.md).

### 14.1 Template system v2 (`src/lib/easy/templates/`)

A template is a **layout program**, not a drawing: an ordered list of
`RowDef`s (slot, zone, font role, weight/size factors, chips, monogram,
alignment, per-row minimum label height), optional `split` columns,
optional vertical rows (rotated brand rails with reserved gutters),
`DecorDef`s (corners, dividers, side rails, medallions, frames, inset and
gradient bands), a `codePlacement` policy, palettes, a `pairingId`, and
`EnhancedTemplateMetadata` (family, categories, moods, compatible
materials/vial types/volumes, recommended glass colors, supported content
density, color mode, difficulty, premium/featured). `defineTemplate()`
fills defaults; the registry (`templates/index.ts`) aggregates 9 files
into `EASY_TEMPLATES` (120) with family/category/material query helpers.

Distinctness is enforced, not promised: a **layout-DNA test** fingerprints
every template (pairing, alignment, split/vertical structure, code
placement, decor kinds, and the full row slot:zone:chip:monogram
sequence) and fails on duplicates — color swaps cannot pad the count.

Templates may also be **vial-locked** (`compatibleVialTypes` /
`compatibleVolumesMl`, enforced by `templateFitsVial`): the recommender,
browser, editor strip, and "Make it…" actions only offer them on
matching vial presets (never on unknown/custom containers), the
recommender boosts them as purpose-built ("designed for this exact
vial"), and the validation matrix builds them on exactly the geometries
they can appear on — e.g. `crimp-dose`, dimensioned for the 10 mL
crimp-top vial's 71.6 × 28 mm wrap.

### 14.2 Typography (`typography.ts`)

Fonts are **pairing-driven**. A `FontPairing` names a display, body, and
technical family with per-role weight ladders (first entry = default;
`emphasis` rows take the heaviest declared weight), default tracking,
uppercase roles, and per-role minimum print sizes (delicate serifs carry
higher floors). Templates reference a `pairingId`; rows reference roles;
users pick a **personality** (10 plain-language groups over the 27
pairings) — no font dropdown exists in Easy mode. A document-level
`easy.pairingId` overrides the template's pairing and is cleared on
template switch. `ensureEasyFonts` preloads every declared weight before
the engine measures, so metrics never shift after the fact. The registry
test (`src/lib/fonts/registry.test.ts`) enforces manifest ↔ disk parity,
rejects variable fonts, and checks glyph coverage; `scripts/fetch-fonts.mjs`
regenerates the library with license verification (OFL/Apache/UFL only).

### 14.3 The engine's honesty ladders (`instantiate.ts`)

The engine never overlaps, never silently drops, and never breaks print
floors. When content pressure exceeds space it degrades **in the open**:

- **Code placement ladder** — requested corner/center/side placement is
  checked against rough floor estimates first; codes fall back
  corner → center → stacked center → side gutter (QR may shrink toward
  its 9 mm scannability floor) → **off**, with a plain-language note and
  the slot listed in `hiddenSlots` so the form shows it as "doesn't fit"
  rather than lying.
- **Iterative shrink-to-fit** — text squeezes toward per-role print
  floors with wrap-aware re-measurement; floor-pinned rows are detected
  rather than squeezed past legibility.
- **Drop order** — if floors still can't fit everything, optional fields
  collapse in a fixed order (verification → website → … → strength),
  never brand or product name, each announced in `notes` + `hiddenSlots`.
- **Readability protection** — effect placements (below) auto-insert
  panels/chips under text on film; accent-backed rows auto-bold; contrast
  is validated against the **actual backing** (panel, chip, band, or
  background), not the nominal palette.

### 14.4 Effect placements (`materials.ts` + engine)

For holographic/metallic/neon materials the user answers "Where should
the effect go?": full coverage, border, logo/monogram, title, accent
panel, or background+panel — each a beginner-labeled `EffectPlacement`
with a hint. The engine resolves `auto` per template and material
intensity, and every placement carries automatic readability protection
(footer panels, hero panels, chips on uncovered rows, frame effects).

### 14.5 The validation harness (`validate.ts`)

Every template runs a matrix before it can ship: real vial presets plus
narrow/wide/short/tall edge shapes × content scenarios (minimal,
baseline, long-name, detailed, QR, barcode, codes+detailed) × material
cases (plain + the template's compatible effect materials at stress
intensities). Checks: slot presence (honoring declared `hiddenSlots`),
density honesty (a template claiming "detailed" must actually fit it at
30 mL), trim bounds (rotation-aware), ≥4 pt floors, visual hierarchy
(product name dominates), QR ≥ 8.95 mm with clear quiet zones, barcode
width floors, pairwise overlap, WCAG-style contrast against computed
backings, and static structure (pairing/weight references, duplicate
slots). `npm test` runs the full matrix (~3,300 engine builds, <1 s);
`npm run validate:templates` prints the verbose report. **Fix the
template or the engine — never the gate** (AGENTS.md invariant 13).

### 14.6 Template browser (`template-browser.tsx`, `/library`)

Cards are engine renders of the user's own words (brand/product fields
if present), lazily built on viewport approach (IntersectionObserver)
and cached in a module LRU keyed by template/palette/material/size/words.
Favorites persist locally; filters cover category/tone/density/favorites
(fixed bottom sheet on phones); sections are Featured + primary
categories with honest hidden-count copy when filters exclude templates.
The detail view holds the app's **only** 3D scene in the browser context.
In the editor it applies via `applyEasyChange` (undoable); in create mode
it builds a document and creates the project directly.

### 14.7 Logo upload (`logo.ts`, content form)

PNG/JPG/WebP → downscaled ≤512 px canvas PNG data URL + aspect ratio,
stored via the normal Easy change path (`meta.logoAspect`), placed by the
engine as a header stack item that reflows with everything else. SVG is
rejected with a pointer to the Advanced Editor's sanitizing asset
pipeline. Undo works because it is one gesture like any other change.
