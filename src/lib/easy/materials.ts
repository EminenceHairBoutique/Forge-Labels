/**
 * Beginner materials — the Easy Creator's material vocabulary. Each
 * material bundles: a real substrate, optional finish patterns, curated
 * palettes, plain-language descriptions (§2 of the UX brief), and design
 * rules (§6) the layout engine applies automatically.
 *
 * Everything maps onto the EXISTING finish/substrate system — screen
 * previews are simulations and every card says so where it matters.
 */

export type MaterialId =
  | "holographic"
  | "neon"
  | "glossy"
  | "plain"
  | "matte"
  | "clear"
  | "metallic"
  | "kraft";

export type Intensity = "subtle" | "balanced" | "bold" | "maximum";

export interface MaterialOption {
  id: string;
  name: string;
  /** One-line plain description ("Changes color as the vial moves…"). */
  description: string;
  bestFor: string;
  durability: "waterproof film" | "standard paper" | "premium paper";
  /** True when a specialty stock/printer is required. */
  specialtyPrinter: boolean;
  /** Physical stock this option maps to. */
  substrateId: string;
  /** Finish pattern used for effect areas (holographic/metallic). */
  finishId?: string;
  /** Card swatch. */
  swatch:
    | { kind: "finish"; finishId: string }
    | { kind: "color"; color: string }
    | { kind: "duo"; a: string; b: string };
}

export interface MaterialRules {
  /**
   * Whether text regions need an opaque contrast panel when the effect
   * covers the background (holographic film, full-coverage finishes).
   */
  contrastPanelOnFullEffect: boolean;
  /** Effect coverage per intensity: what the finish is allowed to cover. */
  coverage: Record<Intensity, "accents" | "band" | "panel" | "background">;
  /** Substrate shows through where artwork is transparent. */
  transparentSubstrate: boolean;
  /** Plain-language note about white ink on clear/metallic stock. */
  whiteInkNote?: string;
  /**
   * Surface sheen simulated on the 3D vial preview (never in the artwork —
   * "material finish" stays separate from "design color").
   */
  sheen?: "gloss" | "matte";
}

export interface MaterialDef {
  id: MaterialId;
  name: string;
  tagline: string;
  /** Primary (big card) or additional (smaller row). */
  primary: boolean;
  /** Shown under previews that simulate a physical effect. */
  simulationNote?: string;
  options: MaterialOption[];
  paletteIds: string[];
  defaultOptionId: string;
  defaultPaletteId: string;
  defaultIntensity: Intensity;
  rules: MaterialRules;
}

const NO_EFFECT_RULES: MaterialRules = {
  contrastPanelOnFullEffect: false,
  coverage: { subtle: "accents", balanced: "accents", bold: "accents", maximum: "accents" },
  transparentSubstrate: false,
};

export const MATERIALS: readonly MaterialDef[] = [
  {
    id: "holographic",
    name: "Holographic",
    tagline: "Rainbow shine that shifts as the vial moves.",
    primary: true,
    simulationNote:
      "On-screen shine is a simulation — a specialty holographic label stock produces the real effect.",
    options: [
      {
        id: "rainbow-prism",
        name: "Rainbow prism",
        description: "Changes color as the vial moves. Best for bold, premium products.",
        bestFor: "Bold, premium products",
        durability: "waterproof film",
        specialtyPrinter: true,
        substrateId: "holo-pet",
        finishId: "holo-prism",
        swatch: { kind: "finish", finishId: "holo-prism" },
      },
      {
        id: "shattered-glass",
        name: "Shattered glass",
        description: "Angular iridescent shards — edgy and eye-catching.",
        bestFor: "Statement designs",
        durability: "waterproof film",
        specialtyPrinter: true,
        substrateId: "holo-pet",
        finishId: "holo-shatter",
        swatch: { kind: "finish", finishId: "holo-shatter" },
      },
      {
        id: "holo-sparkle",
        name: "Holographic sparkle",
        description: "Fine glittering dots of rainbow light.",
        bestFor: "Beauty and cosmetics",
        durability: "waterproof film",
        specialtyPrinter: true,
        substrateId: "holo-pet",
        finishId: "holo-dots",
        swatch: { kind: "finish", finishId: "holo-dots" },
      },
      {
        id: "iridescent-wave",
        name: "Iridescent wave",
        description: "Soft flowing bands of shifting color.",
        bestFor: "Elegant, calm designs",
        durability: "waterproof film",
        specialtyPrinter: true,
        substrateId: "holo-pet",
        finishId: "holo-wave",
        swatch: { kind: "finish", finishId: "holo-wave" },
      },
      {
        id: "silver-holo",
        name: "Silver holographic",
        description: "Bright silver base with a rainbow flash.",
        bestFor: "Tech and lab looks",
        durability: "waterproof film",
        specialtyPrinter: true,
        substrateId: "silver-pet",
        finishId: "holo-rainbow",
        swatch: { kind: "finish", finishId: "holo-rainbow" },
      },
      {
        id: "transparent-holo",
        name: "Transparent holographic",
        description: "See-through film with a rainbow shimmer where light hits.",
        bestFor: "No-label looks with sparkle",
        durability: "waterproof film",
        specialtyPrinter: true,
        substrateId: "clear-pp",
        finishId: "holo-wave",
        swatch: { kind: "finish", finishId: "holo-wave" },
      },
    ],
    paletteIds: [
      "holo-black",
      "holo-white",
      "silver-black",
      "purple-prism",
      "blue-prism",
      "pastel-iris",
    ],
    defaultOptionId: "rainbow-prism",
    defaultPaletteId: "holo-black",
    defaultIntensity: "balanced",
    rules: {
      contrastPanelOnFullEffect: true,
      coverage: {
        subtle: "accents",
        balanced: "band",
        bold: "panel",
        maximum: "background",
      },
      transparentSubstrate: false,
    },
  },
  {
    id: "neon",
    name: "Neon",
    tagline: "Loud fluorescent color that demands attention.",
    primary: true,
    simulationNote:
      "“Neon” means bright fluorescent-look ink and colors — a printed label doesn't emit light.",
    options: [
      { id: "neon-pink", name: "Neon pink", description: "Hot pink that jumps off the shelf.", bestFor: "Beauty, energy", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#ff2ea6" } },
      { id: "electric-blue", name: "Electric blue", description: "Vivid blue with a cool glow-like edge.", bestFor: "Tech, fitness", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#2e6bff" } },
      { id: "acid-green", name: "Acid green", description: "High-voltage green with maximum punch.", bestFor: "Bold statements", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#84cc16" } },
      { id: "neon-orange", name: "Neon orange", description: "Blazing safety-orange energy.", bestFor: "Sport, energy", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#ff6a13" } },
      { id: "purple-glow", name: "Purple glow", description: "Deep violet with an electric feel.", bestFor: "Night-time products", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#8b5cf6" } },
      { id: "cyan-magenta", name: "Cyan & magenta", description: "The classic clash — retro-future energy.", bestFor: "Futuristic brands", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "duo", a: "#06b6d4", b: "#e11ec9" } },
      { id: "blacklight", name: "Blacklight-inspired", description: "Dark base with colors that look UV-lit.", bestFor: "Club, nightlife", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "duo", a: "#12002b", b: "#c026d3" } },
      { id: "custom-neon", name: "Custom combination", description: "Pick your own bright pair.", bestFor: "Your brand colors", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "duo", a: "#ff2ea6", b: "#2e6bff" } },
    ],
    paletteIds: [
      "neon-cyan-magenta",
      "neon-acid",
      "neon-violet-blue",
      "neon-pink-orange",
      "neon-white-pink",
      "neon-navy-cyan",
    ],
    defaultOptionId: "neon-pink",
    defaultPaletteId: "neon-cyan-magenta",
    defaultIntensity: "bold",
    rules: {
      contrastPanelOnFullEffect: false,
      coverage: { subtle: "accents", balanced: "band", bold: "panel", maximum: "background" },
      transparentSubstrate: false,
    },
  },
  {
    id: "glossy",
    name: "Glossy",
    tagline: "Wet-look shine over rich color.",
    primary: true,
    simulationNote:
      "Gloss is a surface finish — it adds shine on the vial preview without changing your design's colors.",
    options: [
      { id: "high-gloss", name: "High gloss", description: "Maximum shine over the whole label.", bestFor: "Premium retail", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "duo", a: "#ffffff", b: "#d7dae1" } },
      { id: "clear-gloss", name: "Clear gloss", description: "Glossy see-through film.", bestFor: "No-label look", durability: "waterproof film", specialtyPrinter: false, substrateId: "clear-pp", swatch: { kind: "duo", a: "#e8ebf0", b: "#ffffff" } },
      { id: "gloss-white", name: "Glossy white", description: "Bright white with a clean shine.", bestFor: "Skincare, clinical", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#ffffff" } },
      { id: "gloss-black", name: "Glossy black", description: "Deep piano-black shine.", bestFor: "Luxury", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#141418" } },
      { id: "gloss-metal-accent", name: "Gloss + metallic accents", description: "Shine plus gold or silver details.", bestFor: "Premium gifting", durability: "waterproof film", specialtyPrinter: true, substrateId: "white-pp", finishId: "foil-gold", swatch: { kind: "finish", finishId: "foil-gold" } },
      { id: "spot-gloss", name: "Spot-highlight look", description: "Shiny highlights over selected areas.", bestFor: "Subtle luxury", durability: "waterproof film", specialtyPrinter: true, substrateId: "white-pp", swatch: { kind: "duo", a: "#f4f4f6", b: "#c9ccd4" } },
    ],
    paletteIds: [
      "gloss-black-gold",
      "white-silver",
      "deep-red-black",
      "navy-white",
      "emerald-gold",
      "rose-cream",
      "noir-silver",
      "noir-blue",
    ],
    defaultOptionId: "high-gloss",
    defaultPaletteId: "gloss-black-gold",
    defaultIntensity: "balanced",
    rules: { ...NO_EFFECT_RULES, sheen: "gloss" },
  },
  {
    id: "plain",
    name: "Plain",
    tagline: "Clean, affordable, easy to print anywhere.",
    primary: true,
    options: [
      { id: "plain-white", name: "White", description: "The standard — prints anywhere, always readable.", bestFor: "Everything", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#ffffff" } },
      { id: "plain-black", name: "Black", description: "Dark and confident.", bestFor: "Premium minimal", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#141418" } },
      { id: "plain-cream", name: "Cream", description: "Soft warm white with a premium feel.", bestFor: "Natural, artisanal", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#f6efe3" } },
      { id: "plain-transparent", name: "Transparent", description: "The product shows through the label.", bestFor: "No-label look", durability: "waterproof film", specialtyPrinter: false, substrateId: "clear-pp", swatch: { kind: "duo", a: "#e8ebf0", b: "#ffffff" } },
      { id: "plain-pastel", name: "Pastel", description: "Gentle color without shouting.", bestFor: "Beauty, wellness", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "duo", a: "#f3e8ff", b: "#dbeafe" } },
      { id: "plain-single", name: "Single color", description: "One strong brand color, edge to edge.", bestFor: "Brand recognition", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#1d4ed8" } },
      { id: "plain-clinical", name: "Minimal clinical", description: "White, precise, laboratory-clean.", bestFor: "Pharma-inspired", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "duo", a: "#ffffff", b: "#dbe3ee" } },
      { id: "plain-paper", name: "Standard paper", description: "The affordable classic (not waterproof).", bestFor: "Dry storage, samples", durability: "standard paper", specialtyPrinter: false, substrateId: "textured-paper", swatch: { kind: "color", color: "#f7f3ea" } },
      { id: "plain-waterproof", name: "Waterproof film", description: "Tough white film that survives fridges and spills.", bestFor: "Daily handling", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#fbfbfd" } },
    ],
    paletteIds: ["white-black", "white-blue", "cream-brown", "black-white", "gray-red", "white-green", "noir-silver", "noir-blue"],
    defaultOptionId: "plain-white",
    defaultPaletteId: "white-black",
    defaultIntensity: "subtle",
    rules: { ...NO_EFFECT_RULES },
  },
  {
    id: "matte",
    name: "Matte",
    tagline: "Soft, glare-free, quietly premium.",
    primary: false,
    options: [
      { id: "matte-soft", name: "Matte", description: "No glare, velvety look.", bestFor: "Modern skincare", durability: "waterproof film", specialtyPrinter: false, substrateId: "white-pp", swatch: { kind: "color", color: "#eceff1" } },
      { id: "soft-touch", name: "Soft-touch", description: "Matte with a peach-skin feel in hand.", bestFor: "Luxury unboxing", durability: "waterproof film", specialtyPrinter: true, substrateId: "white-pp", swatch: { kind: "color", color: "#e3e0da" } },
    ],
    paletteIds: ["white-black", "sage-cream", "cream-brown", "black-white", "noir-silver"],
    defaultOptionId: "matte-soft",
    defaultPaletteId: "white-black",
    defaultIntensity: "subtle",
    rules: { ...NO_EFFECT_RULES, sheen: "matte" },
  },
  {
    id: "clear",
    name: "Clear",
    tagline: "The no-label look — your product is the background.",
    primary: false,
    options: [
      { id: "clear-film", name: "Clear film", description: "Fully transparent; only your print shows.", bestFor: "Minimal, modern", durability: "waterproof film", specialtyPrinter: false, substrateId: "clear-pp", swatch: { kind: "duo", a: "#e8ebf0", b: "#ffffff" } },
      { id: "frosted-clear", name: "Frosted clear", description: "Soft misty translucence.", bestFor: "Spa, skincare", durability: "waterproof film", specialtyPrinter: false, substrateId: "clear-pp", swatch: { kind: "duo", a: "#eef1f4", b: "#dfe5ea" } },
    ],
    paletteIds: ["clear-dark", "clear-white"],
    defaultOptionId: "clear-film",
    defaultPaletteId: "clear-dark",
    defaultIntensity: "subtle",
    rules: {
      contrastPanelOnFullEffect: false,
      coverage: { subtle: "accents", balanced: "accents", bold: "panel", maximum: "panel" },
      transparentSubstrate: true,
      whiteInkNote:
        "Light or white artwork can disappear on clear material unless the printer adds a white backing layer — your printer file will say where.",
    },
  },
  {
    id: "metallic",
    name: "Metallic",
    tagline: "Real metal shine — gold, silver, rose gold.",
    primary: false,
    simulationNote:
      "Metallic shine is simulated on screen; the real stock is a mirror-like film.",
    options: [
      { id: "gold-metallic", name: "Gold", description: "Warm mirror gold.", bestFor: "Luxury", durability: "waterproof film", specialtyPrinter: true, substrateId: "silver-pet", finishId: "foil-gold", swatch: { kind: "finish", finishId: "foil-gold" } },
      { id: "silver-metallic", name: "Silver", description: "Bright mirror silver.", bestFor: "Tech, lab", durability: "waterproof film", specialtyPrinter: true, substrateId: "silver-pet", finishId: "foil-silver", swatch: { kind: "finish", finishId: "foil-silver" } },
      { id: "rose-gold", name: "Rose gold", description: "Blushed copper-pink.", bestFor: "Beauty", durability: "waterproof film", specialtyPrinter: true, substrateId: "silver-pet", finishId: "foil-rose", swatch: { kind: "finish", finishId: "foil-rose" } },
      { id: "brushed-metal", name: "Brushed metal", description: "Fine linear industrial grain.", bestFor: "Modern industrial", durability: "waterproof film", specialtyPrinter: true, substrateId: "silver-pet", finishId: "metal-brushed", swatch: { kind: "finish", finishId: "metal-brushed" } },
    ],
    paletteIds: ["silver-black", "gloss-black-gold", "white-silver", "navy-white"],
    defaultOptionId: "gold-metallic",
    defaultPaletteId: "gloss-black-gold",
    defaultIntensity: "balanced",
    rules: {
      contrastPanelOnFullEffect: true,
      coverage: { subtle: "accents", balanced: "band", bold: "panel", maximum: "background" },
      transparentSubstrate: true,
      whiteInkNote:
        "On metallic stock, inks print semi-translucent — the printer file marks where an opaque white base is needed.",
    },
  },
  {
    id: "kraft",
    name: "Kraft",
    tagline: "Warm recycled paper — honest and handmade.",
    primary: false,
    options: [
      { id: "kraft-brown", name: "Kraft paper", description: "Classic brown recycled fiber (not waterproof).", bestFor: "Botanical, artisanal", durability: "standard paper", specialtyPrinter: false, substrateId: "kraft-paper", swatch: { kind: "finish", finishId: "kraft" } },
      { id: "estate-paper", name: "Estate paper", description: "Premium textured cream paper.", bestFor: "Apothecary, craft", durability: "premium paper", specialtyPrinter: false, substrateId: "textured-paper", swatch: { kind: "color", color: "#f7f3ea" } },
    ],
    paletteIds: ["kraft-ink", "cream-brown", "sage-cream"],
    defaultOptionId: "kraft-brown",
    defaultPaletteId: "kraft-ink",
    defaultIntensity: "subtle",
    rules: {
      contrastPanelOnFullEffect: false,
      coverage: { subtle: "accents", balanced: "accents", bold: "band", maximum: "band" },
      transparentSubstrate: true,
    },
  },
] as const;

/**
 * Where a material's effect is applied (§12). "auto" follows the intensity
 * slider; the rest override it. The engine adds readability protection
 * (panels/chips) automatically wherever the effect goes.
 */
export type EffectPlacement =
  | "auto"
  | "accents"
  | "panel"
  | "full"
  | "border"
  | "title";

export const EFFECT_PLACEMENTS: readonly EffectPlacement[] = [
  "auto",
  "accents",
  "panel",
  "full",
  "border",
  "title",
];

export interface PlacementChoice {
  id: EffectPlacement;
  label: string;
  hint: string;
}

/**
 * Placement choices for a material, in beginner words — or null when the
 * material has no effect to place (plain, matte, kraft, glossy: gloss is a
 * surface finish, not artwork).
 */
export function placementChoices(material: MaterialDef): PlacementChoice[] | null {
  const hasFinishOptions = material.options.some((o) => o.finishId);
  if (material.id === "neon") {
    return [
      { id: "auto", label: "Automatic", hint: "Follows the intensity setting" },
      { id: "accents", label: "Color accents", hint: "Neon details on a calm base" },
      { id: "panel", label: "Bright panel", hint: "The product name sits on a neon block" },
      { id: "full", label: "Full bright", hint: "Maximum energy, still readable" },
      { id: "border", label: "Neon border", hint: "A glowing frame around the label" },
      { id: "title", label: "Neon title", hint: "Only the product name goes neon" },
    ];
  }
  if (!hasFinishOptions) return null;
  const noun = material.id === "metallic" ? "metal" : material.name.toLowerCase();
  return [
    { id: "auto", label: "Automatic", hint: "Follows the intensity setting" },
    { id: "accents", label: "Accents only", hint: `Small ${noun} details` },
    { id: "panel", label: "Background + text panel", hint: `${material.name} background with a solid panel for text` },
    { id: "full", label: `Full ${noun}`, hint: "Effect everywhere; text gets protective chips" },
    { id: "border", label: `${material.name} border`, hint: `A ${noun} frame around the edge` },
    { id: "title", label: `${material.name} title`, hint: `The product name itself turns ${noun}` },
  ];
}

export function getMaterial(id: string): MaterialDef | undefined {
  return MATERIALS.find((m) => m.id === id);
}

export function getMaterialOption(
  material: MaterialDef,
  optionId: string,
): MaterialOption {
  return material.options.find((o) => o.id === optionId) ?? material.options[0]!;
}

export const PRIMARY_MATERIALS = MATERIALS.filter((m) => m.primary);
export const EXTRA_MATERIALS = MATERIALS.filter((m) => !m.primary);
