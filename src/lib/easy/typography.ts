/**
 * Typography personalities & curated font pairings.
 *
 * Beginners never see a font dropdown: they pick a personality ("Clean",
 * "Luxury", "Futuristic"…) or just a template — every template references a
 * pairing by id, and "Try another font pairing" cycles through pairings that
 * share the template's mood. Each pairing defines the display/body(/technical)
 * roles, tracking, uppercase defaults, and minimum print sizes the layout
 * engine enforces.
 *
 * Every family referenced here must exist in `public/fonts/manifest.json` —
 * the template validation harness fails the build otherwise.
 */

export type FontRole = "display" | "body" | "technical";

export type PersonalityId =
  | "clean"
  | "luxury"
  | "editorial"
  | "clinical"
  | "bold"
  | "futuristic"
  | "friendly"
  | "botanical"
  | "condensed"
  | "technical";

export interface FontPairing {
  id: string;
  name: string;
  /** Personalities this pairing expresses (first = primary). */
  mood: PersonalityId[];
  displayFamily: string;
  bodyFamily: string;
  /** Mono-ish family for lot/expiry/verification rows (falls back to body). */
  technicalFamily?: string;
  /** Bundled weights the pairing may use; the FIRST is the role default. */
  displayWeights: number[];
  bodyWeights: number[];
  technicalWeights?: number[];
  /** Default letter-spacing per role (em) when a row doesn't specify one. */
  defaultTracking: Partial<Record<FontRole, number>>;
  /** Roles that default to uppercase unless a row overrides casing. */
  uppercaseRoles: FontRole[];
  /**
   * Per-role minimum print sizes (pt). Delicate serifs raise these — thin
   * hairlines disappear below ~7 pt in print. The engine takes
   * max(row.minPt, pairing minimum).
   */
  minimumPrintSizes: Record<FontRole, number>;
}

function pairing(
  id: string,
  name: string,
  mood: PersonalityId[],
  display: { family: string; weights: number[] },
  body: { family: string; weights: number[] },
  extra?: Partial<
    Pick<
      FontPairing,
      | "technicalFamily"
      | "technicalWeights"
      | "defaultTracking"
      | "uppercaseRoles"
      | "minimumPrintSizes"
    >
  >,
): FontPairing {
  return {
    id,
    name,
    mood,
    displayFamily: display.family,
    displayWeights: display.weights,
    bodyFamily: body.family,
    bodyWeights: body.weights,
    technicalFamily: extra?.technicalFamily,
    technicalWeights: extra?.technicalWeights,
    defaultTracking: extra?.defaultTracking ?? {},
    uppercaseRoles: extra?.uppercaseRoles ?? [],
    minimumPrintSizes: {
      display: 6,
      body: 4,
      technical: 4,
      ...extra?.minimumPrintSizes,
    },
  };
}

/** Raised body floor for high-contrast serifs whose hairlines vanish small. */
const DELICATE = { minimumPrintSizes: { display: 7, body: 4.5, technical: 4 } };

export const FONT_PAIRINGS: readonly FontPairing[] = [
  // --- Clean / clinical -------------------------------------------------------
  pairing("neutral-inter", "Neutral Inter", ["clean", "clinical"],
    { family: "inter", weights: [700, 600] },
    { family: "inter", weights: [400, 500, 600] }),
  pairing("modern-clinical", "Modern Clinical", ["clinical", "clean"],
    { family: "manrope", weights: [800, 600] },
    { family: "manrope", weights: [400, 600] },
    { technicalFamily: "ibm-plex-mono", technicalWeights: [400, 600], defaultTracking: { technical: 0.02 } }),
  pairing("pharmaceutical", "Pharmaceutical", ["clinical", "technical"],
    { family: "archivo", weights: [800, 600] },
    { family: "archivo", weights: [400, 600] },
    { technicalFamily: "ibm-plex-mono", technicalWeights: [400, 600] }),
  pairing("minimal-premium", "Minimal Premium", ["clean", "luxury"],
    { family: "sora", weights: [600, 400] },
    { family: "inter", weights: [400, 500, 600] }),
  pairing("contemporary-skincare", "Contemporary Skincare", ["clean", "friendly"],
    { family: "plus-jakarta-sans", weights: [700, 600] },
    { family: "inter", weights: [400, 500] }),
  pairing("grotesk-minimal", "Grotesk Minimal", ["clean"],
    { family: "space-grotesk", weights: [500, 700] },
    { family: "inter", weights: [400, 500, 600] }),
  pairing("airy-modern", "Airy Modern", ["clean", "friendly"],
    { family: "montserrat", weights: [600, 800] },
    { family: "montserrat", weights: [400, 600] }),
  // --- Luxury / editorial -----------------------------------------------------
  pairing("quiet-luxury", "Quiet Luxury", ["luxury", "editorial"],
    { family: "instrument-serif", weights: [400] },
    { family: "dm-sans", weights: [400, 500] }, DELICATE),
  pairing("editorial-beauty", "Editorial Beauty", ["editorial", "luxury"],
    { family: "bodoni-moda", weights: [600, 400, 700] },
    { family: "manrope", weights: [400, 600] }, DELICATE),
  pairing("luxury-classic", "Luxury Classic", ["luxury"],
    { family: "playfair-display", weights: [600, 400, 700] },
    { family: "inter", weights: [400, 500] }, DELICATE),
  pairing("classic-estate", "Classic Estate", ["luxury"],
    { family: "cinzel", weights: [700, 400] },
    { family: "raleway", weights: [400, 500] },
    { uppercaseRoles: ["display"], defaultTracking: { display: 0.08 } }),
  pairing("prata-elegant", "Prata Elegant", ["luxury", "editorial"],
    { family: "prata", weights: [400] },
    { family: "work-sans", weights: [400, 500] }, DELICATE),
  pairing("heritage-apothecary", "Heritage Apothecary", ["botanical", "editorial"],
    { family: "libre-baskerville", weights: [700, 400] },
    { family: "montserrat", weights: [400, 600] }),
  // --- Botanical / friendly ---------------------------------------------------
  pairing("botanical-premium", "Botanical Premium", ["botanical", "luxury"],
    { family: "cormorant-garamond", weights: [600, 500] },
    { family: "work-sans", weights: [400, 500] }, DELICATE),
  pairing("marcellus-calm", "Marcellus Calm", ["botanical", "luxury"],
    { family: "marcellus", weights: [400] },
    { family: "dm-sans", weights: [400, 500] }),
  pairing("warm-editorial", "Warm Editorial", ["editorial", "botanical", "friendly"],
    { family: "fraunces", weights: [600, 400] },
    { family: "lora", weights: [400, 600] }, DELICATE),
  pairing("friendly-organic", "Friendly Organic", ["friendly", "botanical"],
    { family: "quicksand", weights: [600, 400] },
    { family: "nunito-sans", weights: [400, 600] }),
  // --- Bold / condensed -------------------------------------------------------
  pairing("bold-modern", "Bold Modern", ["bold", "clean"],
    { family: "league-spartan", weights: [700, 400] },
    { family: "inter", weights: [400, 500, 600] }),
  pairing("impact-display", "Impact Display", ["bold", "condensed"],
    { family: "bebas-neue", weights: [400] },
    { family: "inter", weights: [500, 400, 600] }),
  pairing("condensed-impact", "Condensed Impact", ["condensed", "bold"],
    { family: "oswald", weights: [600, 400] },
    { family: "barlow-condensed", weights: [400, 600] }),
  pairing("poster-block", "Poster Block", ["condensed", "bold"],
    { family: "anton", weights: [400] },
    { family: "archivo-narrow", weights: [400, 700] }),
  // --- Futuristic / technical -------------------------------------------------
  pairing("futuristic", "Futuristic", ["futuristic", "technical"],
    { family: "oxanium", weights: [700, 400] },
    { family: "space-mono", weights: [400, 700] },
    { defaultTracking: { display: 0.04 } }),
  pairing("cyber-orbit", "Cyber Orbit", ["futuristic"],
    { family: "orbitron", weights: [700, 400, 900] },
    { family: "space-grotesk", weights: [400, 500] },
    { defaultTracking: { display: 0.04 } }),
  pairing("tech-lab", "Tech Lab", ["technical", "futuristic"],
    { family: "chakra-petch", weights: [700, 400] },
    { family: "rajdhani", weights: [400, 600, 700] }),
  pairing("engineered", "Engineered", ["futuristic", "technical"],
    { family: "michroma", weights: [400] },
    { family: "exo-2", weights: [400, 700] },
    { uppercaseRoles: ["display"], defaultTracking: { display: 0.06 } }),
  pairing("audiowide-energy", "Audiowide Energy", ["futuristic", "bold"],
    { family: "audiowide", weights: [400] },
    { family: "exo-2", weights: [400, 700] }),
  pairing("retro-terminal", "Retro Terminal", ["technical"],
    { family: "jetbrains-mono", weights: [700, 400] },
    { family: "jetbrains-mono", weights: [400, 700] },
    { technicalFamily: "jetbrains-mono", technicalWeights: [400, 700] }),
] as const;

export function getPairing(id: string): FontPairing {
  return FONT_PAIRINGS.find((p) => p.id === id) ?? FONT_PAIRINGS[0]!;
}

export function roleFamily(p: FontPairing, role: FontRole): string {
  if (role === "display") return p.displayFamily;
  if (role === "technical") return p.technicalFamily ?? p.bodyFamily;
  return p.bodyFamily;
}

export function roleWeights(p: FontPairing, role: FontRole): number[] {
  if (role === "display") return p.displayWeights;
  if (role === "technical") return p.technicalWeights ?? p.bodyWeights;
  return p.bodyWeights;
}

/** The pairing's default weight for a role (first declared). */
export function roleDefaultWeight(p: FontPairing, role: FontRole): number {
  return roleWeights(p, role)[0] ?? 400;
}

/** All family ids a pairing can touch (for font preloading). */
export function pairingFamilies(p: FontPairing): string[] {
  return [...new Set([p.displayFamily, p.bodyFamily, p.technicalFamily ?? p.bodyFamily])];
}

/**
 * Pairings that suit a template, best first: same primary mood, then any
 * shared mood, then the rest — deterministic order for "Try another font".
 */
export function pairingsForMood(moods: readonly PersonalityId[]): FontPairing[] {
  const primary = moods[0];
  const rank = (p: FontPairing): number => {
    if (primary && p.mood[0] === primary) return 0;
    if (p.mood.some((m) => moods.includes(m))) return 1;
    return 2;
  };
  return [...FONT_PAIRINGS].sort(
    (a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id),
  );
}

// ---------------------------------------------------------------------------
// Typography personalities (the beginner-facing layer)
// ---------------------------------------------------------------------------

export interface Personality {
  id: PersonalityId;
  name: string;
  blurb: string;
}

export const PERSONALITIES: readonly Personality[] = [
  { id: "clean", name: "Clean", blurb: "Modern, quiet, effortless to read." },
  { id: "luxury", name: "Luxury", blurb: "Refined serifs and generous spacing." },
  { id: "editorial", name: "Editorial", blurb: "High-contrast type with magazine polish." },
  { id: "clinical", name: "Clinical", blurb: "Precise, trustworthy, laboratory-grade." },
  { id: "bold", name: "Bold", blurb: "Big confident type that carries the label." },
  { id: "futuristic", name: "Futuristic", blurb: "Engineered, techy, a little sci-fi." },
  { id: "friendly", name: "Friendly", blurb: "Soft shapes with an approachable voice." },
  { id: "botanical", name: "Botanical", blurb: "Natural, organic, hand-crafted feeling." },
  { id: "condensed", name: "Condensed", blurb: "Tall narrow type — maximum impact per mm." },
  { id: "technical", name: "Technical", blurb: "Monospace details and data-sheet clarity." },
] as const;

export function pairingsForPersonality(id: PersonalityId): FontPairing[] {
  const exact = FONT_PAIRINGS.filter((p) => p.mood[0] === id);
  const rest = FONT_PAIRINGS.filter((p) => p.mood[0] !== id && p.mood.includes(id));
  return [...exact, ...rest];
}
