import type { MaterialId } from "../materials";
import type { SlotId } from "../slots";
import type { FontRole, PersonalityId } from "../typography";

/**
 * Easy template definitions, v2. Unlike the classic template registry
 * (complete documents for one vial size), Easy templates are LAYOUT
 * PROGRAMS: slot rows with zone/size/casing rules that the engine
 * instantiates for ANY label geometry — responsive across 10/20/30 mL by
 * construction, material-aware, palette-driven, and typography-driven
 * through a font pairing.
 *
 * v2 adds the browse/recommendation metadata (family, categories, moods,
 * density, color mode, glass, compatibility), the pairing reference, and a
 * richer layout vocabulary: split columns, vertical rows, chips,
 * monograms, dividers, corner marks, side rails, medallions, effect
 * frames, and code placements. Every template must pass
 * `src/lib/easy/validate.ts` before it ships.
 */

export type ZoneId = "header" | "hero" | "footer";
export type ColorRole = "text" | "muted" | "accent" | "onAccent" | "border";

export type TemplateCategory =
  | "research"
  | "pharmaceutical"
  | "biotechnology"
  | "luxury"
  | "clinical"
  | "laboratory"
  | "holographic"
  | "neon"
  | "plain"
  | "glossy"
  | "beauty"
  | "transparent"
  | "botanical";

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  "research",
  "pharmaceutical",
  "biotechnology",
  "luxury",
  "clinical",
  "laboratory",
  "holographic",
  "neon",
  "plain",
  "glossy",
  "beauty",
  "transparent",
  "botanical",
];

export type VibeTag =
  | "clinical"
  | "luxury"
  | "bold"
  | "futuristic"
  | "minimal"
  | "botanical"
  | "playful"
  | "premium";

export type GlassId = "clear" | "amber" | "cobalt" | "frosted" | "opaque";

export type ContentDensity = "minimal" | "standard" | "detailed";

export interface RowDef {
  slot: SlotId;
  zone: ZoneId;
  font: FontRole;
  /** Explicit weight — otherwise the pairing's default for the role. */
  weight?: number;
  /** Use the pairing's HEAVIEST declared weight for this role (warnings…). */
  emphasis?: boolean;
  /**
   * Cap height as a fraction of label height (0.14 on a 26 mm label ≈
   * 10 pt) — this is what makes templates size-responsive.
   */
  sizeFactor: number;
  minPt: number;
  maxLines: number;
  color: ColorRole;
  letterSpacingEm?: number;
  casing?: "uppercase";
  /** Extra space above the row, in mm at a 26 mm label (scaled). */
  spacingBefore?: number;
  /** Put this row in the right column of a split layout. */
  column?: "right";
  /** Rounded pill behind the row — strength badges, category tags. */
  chip?: "fill" | "outline";
  /** Render only the first character, uppercased (brand monograms). */
  monogram?: boolean;
  /** Per-row alignment override (else template alignment). */
  align?: "left" | "center" | "right";
  /** Collapse this row entirely on labels shorter than this (§6). */
  minLabelHeightMm?: number;
}

/** Rotated text along an edge (reads bottom-up on the left, top-down right). */
export interface VerticalRowDef {
  slot: SlotId;
  edge: "left" | "right";
  font: FontRole;
  weight?: number;
  /** Cap height as a fraction of label HEIGHT. */
  sizeFactor: number;
  minPt: number;
  color: ColorRole;
  letterSpacingEm?: number;
  casing?: "uppercase";
}

export type DecorFill =
  | { role: ColorRole }
  | { effect: true }
  /** Accent fading into the background (soft gradient bands). */
  | { gradient: true };

export type DecorDef =
  | { kind: "band"; edge: "top" | "bottom"; heightFactor: number; fill: DecorFill; inset?: boolean; minLabelHeightMm?: number }
  | { kind: "stripe"; edge: "left" | "right"; widthFactor: number; fill: DecorFill; minLabelHeightMm?: number }
  | { kind: "border"; insetMm: number; strokePt: number; color: ColorRole; minLabelHeightMm?: number }
  | { kind: "underline-hero"; widthFactor: number; strokePt: number; fill: DecorFill }
  | { kind: "corners"; lengthMm: number; strokePt: number; color: ColorRole; insetMm: number; minLabelHeightMm?: number }
  | { kind: "divider"; after: SlotId; widthFactor: number; strokePt: number; fill: DecorFill; minLabelHeightMm?: number }
  | { kind: "side-rail"; edge: "left" | "right"; insetMm: number; strokePt: number; color: ColorRole; minLabelHeightMm?: number }
  | { kind: "medallion"; sizeFactor: number; fill: DecorFill; ring?: boolean; minLabelHeightMm?: number }
  | { kind: "frame-effect"; thicknessFactor: number; minLabelHeightMm?: number };

/** Where QR/barcode boxes live. */
export type CodePlacement = "corner" | "side" | "footer-center";

export interface EasyTemplateDef {
  id: string;
  name: string;
  /** Named design family (§5), kebab id — e.g. "obsidian-gold". */
  family: string;
  /** Display name of the family — e.g. "Obsidian Gold". */
  familyName: string;
  /** Browse categories (a template may belong to several). */
  category: TemplateCategory[];
  /** Free-text adjectives for browsing/search ("premium", "airy"…). */
  mood: string[];
  /** Recommendation scoring weights. */
  vibe: Partial<Record<VibeTag, number>>;
  /** Whether the template reads best on light, dark, or either palette. */
  colorMode: "light" | "dark" | "adaptive";
  /** How much content the layout is designed to carry. */
  density: ContentDensity;
  /** Typography via a curated pairing (personality layer). */
  pairingId: string;
  /** Extra pairing moods that suit this template ("try another font"). */
  pairingMoods?: PersonalityId[];
  compatibleVialTypes: "all" | string[];
  compatibleVolumesMl: "all" | number[];
  /** Vial glass colors the design was tuned for (preview + scoring). */
  recommendedGlass: GlassId[];
  /** Detailed layouts need vertical room; hidden below this height. */
  minHeightMm?: number;
  /** Split/side layouts need horizontal room; hidden below this width. */
  minWidthMm?: number;
  /** All Easy templates lay out automatically. */
  difficulty: "automatic";
  premium: boolean;
  featured: boolean;
  align: "left" | "center";
  /** Split layout: rows with `column: "right"` form a second column. */
  split?: { ratio?: number; divider?: boolean };
  verticalRow?: VerticalRowDef;
  rows: RowDef[];
  /** Corner that anchors QR/barcode boxes (corner placement). */
  codeCorner: "bottom-right" | "bottom-left";
  codePlacement?: CodePlacement;
  /** QR size multiplier (QR-first layouts make the code a feature). */
  qrScale?: number;
  decor: DecorDef[];
  materials: MaterialId[] | "all";
}

/**
 * Template author input: everything EasyTemplateDef has, with the
 * boilerplate defaulted so 120 definitions stay terse and consistent.
 */
export type EasyTemplateInput = Omit<
  EasyTemplateDef,
  | "compatibleVialTypes"
  | "compatibleVolumesMl"
  | "recommendedGlass"
  | "difficulty"
  | "premium"
  | "featured"
  | "mood"
  | "materials"
> &
  Partial<
    Pick<
      EasyTemplateDef,
      | "compatibleVialTypes"
      | "compatibleVolumesMl"
      | "recommendedGlass"
      | "premium"
      | "featured"
      | "mood"
      | "materials"
    >
  >;

export function defineTemplate(input: EasyTemplateInput): EasyTemplateDef {
  return {
    compatibleVialTypes: "all",
    compatibleVolumesMl: "all",
    recommendedGlass: [],
    mood: [],
    materials: "all",
    premium: false,
    featured: false,
    ...input,
    difficulty: "automatic",
  };
}

/** Convenience for recommendation code that thinks in dark/light. */
export function templatePrefersDark(t: EasyTemplateDef): boolean {
  return t.colorMode === "dark";
}
