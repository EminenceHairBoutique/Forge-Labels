import { getEasyPalette, type EasyPalette } from "./palettes";
import type { MaterialDef } from "./materials";
import {
  EASY_TEMPLATES,
  templatePrefersDark,
  type EasyTemplateDef,
  type VibeTag,
} from "./templates";

/**
 * Template recommendations: turn the wizard's style answers into 3–6
 * scored picks instead of a wall of thumbnails. Deterministic and
 * data-driven — every card the user sees is already rendered with their
 * vial size, material, and brand text.
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

export interface Recommendation {
  template: EasyTemplateDef;
  palette: EasyPalette;
  /** Card label: "Recommended", "More minimal", "More bold", "More premium". */
  tag: string;
  score: number;
}

const TAG_BY_VIBE: Partial<Record<VibeTag, string>> = {
  minimal: "More minimal",
  bold: "More bold",
  luxury: "More premium",
  premium: "More premium",
  futuristic: "More futuristic",
  clinical: "More clinical",
  botanical: "Softer",
};

/** A template's strongest vibe tag (deterministic tie-break by tag name). */
function dominantVibe(template: EasyTemplateDef): VibeTag | undefined {
  const entries = Object.entries(template.vibe) as [VibeTag, number][];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0]?.[0];
}

function scoreTemplate(
  template: EasyTemplateDef,
  style: StyleChoice | undefined,
  preferDark: boolean | null,
): number {
  let score = 1;
  if (style) {
    for (const [tag, weight] of Object.entries(style.vibes)) {
      score += (template.vibe[tag as VibeTag] ?? 0) * (weight ?? 0);
    }
  }
  if (preferDark !== null && templatePrefersDark(template) === preferDark) score += 2;
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

export function recommendTemplates(options: {
  styleId?: string;
  preferDark?: boolean | null;
  material: MaterialDef;
  count?: number;
}): Recommendation[] {
  const style = options.styleId ? getStyleChoice(options.styleId) : undefined;
  const preferDark = options.preferDark ?? null;
  const count = options.count ?? 4;

  const eligible = EASY_TEMPLATES.filter(
    (t) => t.materials === "all" || t.materials.includes(options.material.id),
  );

  const scored = eligible
    .map((template) => ({
      template,
      score: scoreTemplate(template, style, preferDark),
      palette: pickPalette(options.material, template, preferDark),
    }))
    .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));

  // One per family so the picks feel genuinely different.
  const seen = new Set<string>();
  const picks: Recommendation[] = [];
  for (const entry of scored) {
    if (seen.has(entry.template.family)) continue;
    seen.add(entry.template.family);
    const vibe = dominantVibe(entry.template);
    picks.push({
      ...entry,
      tag:
        picks.length === 0
          ? "Recommended"
          : ((vibe && TAG_BY_VIBE[vibe]) ?? "Different take"),
    });
    if (picks.length >= count) break;
  }
  return picks;
}
