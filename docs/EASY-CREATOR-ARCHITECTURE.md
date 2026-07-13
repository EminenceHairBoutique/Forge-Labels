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
| `slots.ts` | Slot ids, labels, form metadata (input kind, toggle group, placeholder), priority order |
| `materials.ts` | Beginner materials (holographic/neon/glossy/plain/matte/clear/metallic/kraft) + sub-options → `{ substrateId, finishId?, palettes, rules, plain descriptions }` |
| `palettes.ts` | Curated palettes per material/style with guaranteed text contrast |
| `templates/` | `EasyTemplateDef`s: slot layouts as label-relative regions + font/line rules; families (clinical, luxury, bold, futuristic, minimal, botanical…) |
| `instantiate.ts` | `(def, geometry, material, palette, fields) → LabelDocument` — generates real objects with `slot` markers; responsive across 10/20/30 mL by construction |
| `layout.ts` | Auto-fit font sizing, line clamping, vertical reflow, hide-when-empty collapse, overlap prevention (pure; text measurer injectable for node tests) |
| `fields.ts` | Read current field values from a doc; write via commands (one gesture per form edit); toggle slots on/off with `easy.stash` |
| `recommend.ts` | Style/brand answers → scored template recommendations (Recommended / More minimal / More bold / More premium) |
| `variations.ts` | One-click controlled variations (palette shifts, layout swaps, dark/light, density) — all undoable |
| `plain-preflight.ts` | Preflight `ruleId` → plain-language message + optional one-click fix command |
| `family.ts` | Matching product-line generator (preserve identity, change product fields; strength color coding) |
| `draft.ts` | Wizard draft persistence (localStorage) so refresh never loses progress |
| `spec-sheet.ts` | Printer specification summary (text + PDF page) |

## 4. Route map

| Route | Purpose |
| --- | --- |
| `/create` | Guided wizard: vial → material → style → recommendations. Step in `?step=`; draft in localStorage. Mobile-first: one question per screen |
| `/easy/[id]` | Easy editor: content form + live vial preview + variations + plain-language export |
| `/editor/[id]` | Advanced Editor (existing) |
| `/dashboard` | Creation-first: big "Make a new label", recent labels as vial cards, "Create a matching label"; empty state asks "What would you like to make?" |
| `/templates` | Kept; template cards deep-link into the wizard with the template preselected |

## 5. Component architecture (`src/components/easy/`)

```
create-wizard.tsx        — step shell: progress, back, sticky Continue
  steps/vial-step.tsx    — visual vial cards + "know your measurements?" branch
  steps/material-step.tsx— material cards (animated) + sub-options + descriptions
  steps/style-step.tsx   — feel cards + optional brand questions
  steps/pick-step.tsx    — 3–6 recommended designs as vial mockups
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

`recommend(answers, material)` scores each template family: style-tag
match (×3), material affinity (×2), light/dark preference (×1), brand-name
length fit (×1). Top scorer renders as "Recommended"; the next picks are
labeled by family metadata (minimal / bold / premium). Every card is a
full vial mockup rendered from the user's actual size, material, brand,
and product name via `instantiate` + `renderThumbnail` + the vial scene.

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
