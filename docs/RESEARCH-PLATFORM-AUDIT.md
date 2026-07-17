# Research-platform upgrade — delta audit & plan

Audit of the repository against the "professional pharmaceutical and
research-label platform" brief, written BEFORE implementation. This build
follows two shipped overhauls (the beginner-first Easy Creator and the
template/typography/material overhaul — see
[TEMPLATE-TYPOGRAPHY-AUDIT.md](./TEMPLATE-TYPOGRAPHY-AUDIT.md)), so most
of the brief's platform is already real. This document maps every section
of the brief to current state, classifies the gaps, and sets the plan.

Baseline gate at audit time: lint ✓ · typecheck ✓ · 404 unit tests ✓ ·
build ✓ · 63 e2e ✓ (incl. dimensional, parity, perf). Vercel deploys the
default branch; this work continues on the existing feature branch.

## What already exists (verified in code, not assumed)

| Brief section | Status | Where |
| --- | --- | --- |
| §4 Two connected modes, one document | ✅ Shipped | `/create`+`/easy/[id]` ↔ `/editor/[id]`, `easy` block on the same `LabelDocument`, mode switch lossless (e2e-verified) |
| §8/9 partial: 121 validated templates (clinical 29, laboratory 26, plain 44, luxury 31…) | ✅ Shipped, needs expansion | `src/lib/easy/templates/` + `validate.ts` quality gates + layout-DNA uniqueness |
| §10 Semantic slots with constraints | ✅ Core shipped | 17 slots incl. lot/expiry/verification/qr/barcode; per-row size/lines/floors/collapse; **research fields missing** (see gaps) |
| §12 Typography personalities | ✅ Shipped | 27 pairings / 10 personalities incl. the brief's named pairs (Manrope+IBM Plex Mono, Archivo+IBM Plex Mono, Sora, Oxanium+Space Mono, Cormorant…); 38 licensed local families; technical/mono role reserved for lot/expiry/verification |
| §13 Deterministic layout engine | ✅ Shipped | auto-fit, wrap-aware shrink, honest drop ladders, code-placement fallbacks, seam/quiet-zone protection, one-click actions (premium/cleaner/bolder/clinical/futuristic + fixes) |
| §14 partial: matching sibling label | ✅ Single-sibling | `family.ts` + strength color coding; **series/table/CSV missing** |
| §17/18 Materials + material-aware rules | ✅ Shipped | 8 materials, sub-options, intensity, effect placements with readability protection; artwork/simulation separation enforced (gloss = preview sheen only) |
| §19 Preview | ✅ Shipped | one live 3D scene (glass colors, crimp/flip-off/screw/dropper/pump caps, cap color, liquid, fill), flat view, cached thumbnails everywhere else |
| §20/21 Printing | ✅ Shipped | home-print imposition (Letter/A4/custom, calibration, offsets, partial sheets), printer ZIP (print PDF + spec sheet), separations/white-ink/foil layers in Advanced |
| §22 Plain-language preflight | ✅ Shipped | severity + plain copy + one-click fixes (incl. "Fix contrast", QR enlarge) |
| §25 Mobile-first wizard | ✅ Shipped | one decision/screen, sticky Continue, bottom sheets, no hover/drag, e2e on iPhone viewport |
| §26/27 Browser + six-role recommendations | ✅ Shipped, needs industry axis | `/library`, favorites, filters, engine-rendered cards; deterministic scoring with reasons; vial-locked template support |
| §24 Assistant | ✅ Key-gated, Advanced only | 16 typed tools over the command bus; app fully functional without it |
| §30–33 Perf/a11y/security/tests | ✅ Reports shipped | PERFORMANCE.md, ACCESSIBILITY.md, server-only secrets, RLS, 404 unit + 63 e2e |

## Gaps this build closes (the real delta)

| # | Gap | Brief | Priority |
| --- | --- | --- | --- |
| 1 | **Research field vocabulary**: abbreviation, catalog №, SKU, batch, date produced, retest date, purity, molecular formula, molecular weight, CAS, sequence, COA reference, research-use notice, company contact | §6, §10 | Critical |
| 2 | **Industry / label-purpose step** ("What type of label are you creating?") driving templates, fields, notices, density | §5 | Critical |
| 3 | **Research-use notice system**: curated neutral notices, review-before-export, compliance reminder, admin-configurable copy | §7 | Critical |
| 4 | **Compliance safeguards**: flagged-phrase scanner (treats/cures/inject/dosage/FDA approved…), warn-and-review (never silent deletion), acknowledgment audit trail on the project | §29 | Critical |
| 5 | **Content-density modes** as field SETS (Essential/Standard/Detailed) the user can switch in the editor | §11 | High |
| 6 | **Research/pharma/biotech template families** (+~30 structurally distinct: peptide research, dark laboratory, premium biotechnology) → ≥60 research-side, ≥150 total | §8, §9 | High |
| 7 | **Product-series generator**: spreadsheet-style rows + CSV import → matching sibling labels with per-row accent coding | §14 | High |
| 8 | **Company profile / content library**: saved notice, storage, website, contact, lot format → prefill new labels | §15 | Medium |
| 9 | **COA/verification presentation**: catalog/lot/batch + QR-to-COA patterns in templates and form guidance (verification PAGE hosting stays deferred — see deferred.md) | §16 | Medium |
| 10 | **Educational guides** section (measuring, wrap styles, QR sizing, materials, lot/batch organization, artwork vs verified data) | §23 | Medium |
| 11 | Browser sections/filters for research industries; dashboard "Create a research label" | §26, §28 | Medium |
| 12 | Recommendation industry input + "Most clinical" role in research contexts | §27 | Medium |

Classification: nothing in the current app is *broken* against the brief
(no critical defects found; gates green). The delta is additive scope.

## Honest constraints & non-goals (stated up front)

- **No invented science.** CAS numbers, formulas, weights, sequences,
  purity, and test results are user-supplied text rendered verbatim; the
  form labels them as unverified and never suggests values.
- **No regulatory theater.** No FDA/GMP/ISO/NDC/DEA/prescription marks
  are generated; regulated identifiers are plain user text behind an
  explicit "I am authorized" confirmation.
- **No medical or personal-use instructions** anywhere in templates,
  placeholder copy, guides, or assistant behavior.
- **Verification-page hosting** (a public per-batch COA page served by
  Forge Labels for businesses) needs storage/auth product decisions —
  deferred honestly; QR-to-your-own-URL + COA reference fields ship now.
- **"Popular" sections** still need real analytics — not faked.
- **Color-coded compound series** ship through the series generator's
  per-row accent coding (+ structurally distinct compound-series
  templates), NOT as ten recolors padding the template count — the
  layout-DNA gate forbids that by construction.

## Competitive design principles applied (category-level, no endorsements)

Distilled from the referenced categories (research-compound catalogs,
laboratory suppliers, biotech brands, label-tool UX). Neutral principles
only — no supplier is quoted, copied, or characterized:

1. **Identity vs data split.** Credible lab labels separate the brand/
   compound identity block from a dense technical panel (catalog, lot,
   batch, dates) — usually with a rule or column, monospace for the data.
2. **Compound + amount dominate.** The compound name and the amount
   ("BPC-157 · 5 mg" pattern) carry the hierarchy; everything else is
   deliberately quiet.
3. **Batch visibility builds trust.** Lot/batch/retest presented as
   first-class, consistently formatted fields — not fine print.
4. **Verification is a loop.** Catalog № + lot + QR → a document the
   buyer can check; the label's job is to carry the pointer legibly.
5. **Restraint reads as science.** White space, one accent, geometric
   sans or grotesk display + mono data, thin rules — not decoration.
6. **Notices are typographically loud but visually calm** — uppercase,
   tracked, boxed or ruled, never buried.
7. **Families look like systems**: same grid, same type, one variable
   (accent/amount) changing per product.
8. **Template discovery works by use-case first** (industry sections),
   then style filters — not a wall of thumbnails.

## Plan (dependency order, gates green at every step)

- **R1 Core schema**: 14 research slots; `industries.ts` (13 purposes);
  `notices.ts` (5 neutral notices + custom); density field-sets;
  compliance scanner; `easy.industry`/`densityMode`/`noticeId`/
  `complianceAck`; schema v4 (stamp migration).
- **R2 Workflows**: wizard industry step; research form sections with
  unverified-data framing; notice picker + review-before-export;
  flagged-phrase acknowledgment gate wired into the export wizard;
  density switcher + "Show more/less technical information" actions.
- **R3 Templates**: 3 new families × 10 (peptide research, dark
  laboratory, premium biotechnology) on the new slots; categories
  `research`/`pharmaceutical`/`biotechnology`; validation scenarios
  extended with research-field stress cases; ≥150 total.
- **R4 Series**: matching-series table + CSV import → sibling projects;
  company profile prefill.
- **R5 Discovery**: industry-aware scoring + Most clinical role; browser
  sections/filters; dashboard research action.
- **R6 Content & closure**: guides section; unit + e2e additions; docs;
  reports; full gate; push.
