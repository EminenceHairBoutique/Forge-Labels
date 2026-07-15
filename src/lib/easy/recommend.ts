import { getEasyPalette, type EasyPalette } from "./palettes";
import type { MaterialDef } from "./materials";
import {
  EASY_TEMPLATES,
  templateFitsVial,
  templateIsVialSpecific,
  templatePrefersDark,
  type ContentDensity,
  type EasyTemplateDef,
  type GlassId,
  type VibeTag,
} from "./templates";

/**
 * Template recommendations (§7): deterministic, metadata-driven scoring
 * turns the wizard's answers into six labeled picks — best match, most
 * professional, most minimal, most bold, most premium, and an alternative
 * style — each with a one-sentence plain-language reason. Every card the
 * user sees is already rendered with their vial size, material, and words.
 */

export interface StyleChoice {
  id: string;
  name: string;
  /** One-line description on the card. */
  blurb: string;
  vibes: Partial<Record<VibeTag, number>>;
  prefersDark?: boolean;
}

export const STYLE_CHOICES: readonly StyleChoice[] = [
  { id: "clean-clinical", name: "Clean and clinical", blurb: "Precise, trustworthy, laboratory-white.", vibes: { clinical: 3, minimal: 1 } },
  { id: "luxury", name: "Luxury", blurb: "Serif elegance and rich, deep color.", vibes: { luxury: 3, premium: 2 }, prefersDark: true },
  { id: "bold-modern", name: "Bold and modern", blurb: "Big type. No apologies.", vibes: { bold: 3 } },
  { id: "futuristic", name: "Futuristic", blurb: "Techy, engineered, a little sci-fi.", vibes: { futuristic: 3 }, prefersDark: true },
  { id: "neon-energetic", name: "Neon and energetic", blurb: "Electric color and high contrast.", vibes: { bold: 2, playful: 2, futuristic: 1 }, prefersDark: true },
  { id: "minimal", name: "Minimal", blurb: "Quiet confidence and whitespace.", vibes: { minimal: 3 } },
  { id: "skincare-beauty", name: "Skincare and beauty", blurb: "Soft, refined, shelf-ready.", vibes: { luxury: 1, minimal: 2, botanical: 1 } },
  { id: "botanical", name: "Botanical", blurb: "Natural, organic, hand-crafted.", vibes: { botanical: 3 } },
  { id: "dark-premium", name: "Dark and premium", blurb: "Black-label energy.", vibes: { premium: 3, luxury: 1, bold: 1 }, prefersDark: true },
  { id: "bright-playful", name: "Bright and playful", blurb: "Friendly color and personality.", vibes: { playful: 3, bold: 1 } },
  { id: "pharma", name: "Pharmaceutical-inspired", blurb: "Regulated-industry seriousness.", vibes: { clinical: 3 } },
  { id: "lab", name: "Research laboratory", blurb: "Data-first, monospace details.", vibes: { clinical: 2, futuristic: 1, minimal: 1 } },
] as const;

export function getStyleChoice(id: string): StyleChoice | undefined {
  return STYLE_CHOICES.find((s) => s.id === id);
}

export interface RecommendOptions {
  styleId?: string;
  preferDark?: boolean | null;
  material: MaterialDef;
  count?: number;
  /** How much information must fit (§7). */
  density?: ContentDensity;
  wantsQr?: boolean;
  wantsBarcode?: boolean;
  hasLogo?: boolean;
  /** Vial glass color, for glass-tuned templates. */
  glass?: GlassId;
  /** Actual label dimensions — templates that need more room are skipped. */
  labelWidthMm?: number;
  labelHeightMm?: number;
  /**
   * The vial preset in use — vial-locked templates only appear (and get a
   * strong boost) when this matches their compatibility rules.
   */
  vialPresetId?: string | null;
}

export interface Recommendation {
  template: EasyTemplateDef;
  palette: EasyPalette;
  /** Card label: "Best match", "Most professional", "Most bold"… */
  tag: string;
  score: number;
  /** One sentence explaining the pick, in plain language. */
  reason: string;
}

function scoreTemplate(template: EasyTemplateDef, options: RecommendOptions): number {
  const style = options.styleId ? getStyleChoice(options.styleId) : undefined;
  const preferDark = options.preferDark ?? null;
  let score = 1;
  if (style) {
    for (const [tag, weight] of Object.entries(style.vibes)) {
      score += (template.vibe[tag as VibeTag] ?? 0) * (weight ?? 0);
    }
  }
  if (preferDark !== null && templatePrefersDark(template) === preferDark) score += 2;
  if (options.density) {
    if (template.density === options.density) score += 2.5;
    else if (
      (template.density === "standard") !==
      (options.density === "standard")
    ) {
      // minimal vs detailed are opposite ends — penalize the mismatch.
      score -= 1;
    }
  }
  if (options.wantsQr && (template.qrScale ?? 1) > 1) score += 1.5;
  if (options.wantsQr && template.codePlacement === "side") score += 1.5;
  if (options.wantsBarcode && template.density !== "minimal") score += 0.5;
  if (options.glass && template.recommendedGlass.includes(options.glass)) score += 1.5;
  // A template tuned to the user's exact vial beats generic fits.
  if (templateIsVialSpecific(template) && templateFitsVial(template, options.vialPresetId)) {
    score += 2.5;
  }
  if (template.featured) score += 0.25;
  return score;
}

/** Pick a palette for a template that fits the material + dark preference. */
export function pickPalette(
  material: MaterialDef,
  template: EasyTemplateDef,
  preferDark: boolean | null,
): EasyPalette {
  const candidates = material.paletteIds.map(getEasyPalette);
  const wantDark = preferDark ?? templatePrefersDark(template);
  return candidates.find((p) => p.dark === wantDark) ?? candidates[0]!;
}

/** One plain-language sentence for why a template was picked (§7). */
export function recommendationReason(
  template: EasyTemplateDef,
  options: RecommendOptions,
): string {
  const clauses: string[] = [];
  const material = options.material;
  if (templateIsVialSpecific(template) && templateFitsVial(template, options.vialPresetId)) {
    clauses.push("it was designed for this exact vial");
  }
  const hasFinish = material.options.some((o) => o.finishId);
  if (hasFinish && material.rules.contrastPanelOnFullEffect) {
    clauses.push(
      `its solid panels keep your text readable over the ${material.name.toLowerCase()} film`,
    );
  } else if (material.id === "neon") {
    clauses.push("its high-contrast type carries bright neon color safely");
  }
  if (options.density && template.density === options.density) {
    clauses.push(
      options.density === "minimal"
        ? "it keeps to the essentials you asked for"
        : options.density === "detailed"
          ? "it is designed to carry every detail you plan to include"
          : "it fits your information comfortably",
    );
  }
  if (options.wantsQr && ((template.qrScale ?? 1) > 1 || template.codePlacement === "side")) {
    clauses.push("it gives your QR code real prominence");
  }
  if (options.glass && template.recommendedGlass.includes(options.glass)) {
    clauses.push(`it was tuned for ${options.glass} glass`);
  }
  if (options.preferDark != null && templatePrefersDark(template) === options.preferDark) {
    clauses.push(`it reads beautifully ${options.preferDark ? "dark" : "light"}`);
  }
  if (clauses.length === 0) {
    clauses.push(
      `its ${template.familyName} layout suits ${material.name.toLowerCase()} labels`,
    );
  }
  const sentence = clauses.slice(0, 2).join(" and ");
  return `Recommended because ${sentence}.`;
}

/** The six §7 roles, in presentation order. */
const ROLES: { tag: string; key: (t: EasyTemplateDef) => number }[] = [
  {
    tag: "Most professional",
    key: (t) => (t.vibe.clinical ?? 0) * 2 + (t.vibe.minimal ?? 0) + (t.vibe.premium ?? 0),
  },
  { tag: "Most minimal", key: (t) => t.vibe.minimal ?? 0 },
  { tag: "Most bold", key: (t) => t.vibe.bold ?? 0 },
  { tag: "Most premium", key: (t) => (t.vibe.premium ?? 0) + (t.vibe.luxury ?? 0) },
];

export function recommendTemplates(options: RecommendOptions): Recommendation[] {
  const count = options.count ?? 6;
  const preferDark = options.preferDark ?? null;

  const eligible = EASY_TEMPLATES.filter((t) => {
    if (t.materials !== "all" && !t.materials.includes(options.material.id)) return false;
    if (!templateFitsVial(t, options.vialPresetId)) return false;
    if (options.labelHeightMm && t.minHeightMm && options.labelHeightMm < t.minHeightMm) return false;
    if (options.labelWidthMm && t.minWidthMm && options.labelWidthMm < t.minWidthMm) return false;
    return true;
  });

  const scored = eligible
    .map((template) => ({
      template,
      score: scoreTemplate(template, options),
      palette: pickPalette(options.material, template, preferDark),
    }))
    .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));
  if (scored.length === 0) return [];

  const usedFamilies = new Set<string>();
  const usedIds = new Set<string>();
  const picks: Recommendation[] = [];
  const take = (
    entry: (typeof scored)[number] | undefined,
    tag: string,
  ): void => {
    if (!entry) return;
    usedFamilies.add(entry.template.family);
    usedIds.add(entry.template.id);
    picks.push({
      ...entry,
      tag,
      reason: recommendationReason(entry.template, options),
    });
  };
  const available = () =>
    scored.filter(
      (e) => !usedIds.has(e.template.id) && !usedFamilies.has(e.template.family),
    );

  // 1. Best match: the top overall score.
  take(scored[0], "Best match");

  // 2–5. Role picks: strongest of each role among what's left, but only
  //      when the role genuinely applies (key > 0).
  for (const role of ROLES) {
    if (picks.length >= count) break;
    const pool = available()
      .slice()
      .sort(
        (a, b) =>
          role.key(b.template) - role.key(a.template) ||
          b.score - a.score ||
          a.template.id.localeCompare(b.template.id),
      );
    const top = pool[0];
    if (top && role.key(top.template) > 0) take(top, role.tag);
  }

  // 6. Alternative style: the best remaining pick that LOOKS different
  //    from the best match (different alignment or decor language).
  if (picks.length < count) {
    const best = picks[0]!.template;
    const signature = (t: EasyTemplateDef) =>
      `${t.align}/${t.split ? "split" : "stack"}/${t.decor.map((d) => d.kind).sort().join(",")}`;
    const alt =
      available().find((e) => signature(e.template) !== signature(best)) ??
      available()[0];
    take(alt, "Alternative style");
  }

  // Fill any remaining slots by score (larger counts, small libraries).
  while (picks.length < count) {
    const next = available()[0];
    if (!next) break;
    take(next, "Different take");
  }

  return picks.slice(0, count);
}
