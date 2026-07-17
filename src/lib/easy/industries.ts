import type { SlotId } from "./slots";
import type { TemplateCategory, VibeTag } from "./templates/types";

/**
 * Label purposes (§5 of the research-platform brief): "What type of label
 * are you creating?" The answer steers recommendations, suggested fields,
 * notices, and density — it never adds regulatory claims. "Pharmaceutical-
 * inspired" is a VISUAL direction; nothing here implies approval,
 * prescription status, or certification.
 */

export type IndustryId =
  | "research-peptide"
  | "lab-reagent"
  | "pharmaceutical"
  | "biotechnology"
  | "medical-office"
  | "skincare"
  | "cosmetic"
  | "wellness"
  | "essential-oil"
  | "supplement"
  | "botanical"
  | "general"
  | "custom";

export interface IndustryDef {
  id: IndustryId;
  name: string;
  /** One line on the wizard card — what this purpose sets up. */
  blurb: string;
  /**
   * Research-data industries get the science/batch field vocabulary,
   * research-use notices by default, and the research density sets.
   */
  research: boolean;
  /** Categories whose templates suit this purpose (recommendation boost). */
  categories: TemplateCategory[];
  /** Vibe weights added to recommendation scoring. */
  vibes: Partial<Record<VibeTag, number>>;
  /** Slots suggested ON when this purpose is chosen (Standard density). */
  suggestedSlots: SlotId[];
  /** Offer a research-use notice by default. */
  suggestsNotice: boolean;
  /** QR codes are the norm for this purpose (verification/COA). */
  suggestsQr: boolean;
  /** Style choice preselected in the feel step (user can change it). */
  defaultStyleId?: string;
}

const RESEARCH_SLOTS: SlotId[] = ["lot", "batch", "catalog", "storage", "notice"];

export const INDUSTRIES: readonly IndustryDef[] = [
  {
    id: "research-peptide",
    name: "Research peptide",
    blurb: "Compound, amount, lot, batch, and a research-use notice.",
    research: true,
    categories: ["research", "laboratory", "clinical"],
    vibes: { clinical: 2, minimal: 1 },
    suggestedSlots: RESEARCH_SLOTS,
    suggestsNotice: true,
    suggestsQr: true,
    defaultStyleId: "lab",
  },
  {
    id: "lab-reagent",
    name: "Laboratory reagent",
    blurb: "Clear identity, storage, and batch data for lab shelves.",
    research: true,
    categories: ["laboratory", "clinical"],
    vibes: { clinical: 3 },
    suggestedSlots: RESEARCH_SLOTS,
    suggestsNotice: true,
    suggestsQr: false,
    defaultStyleId: "lab",
  },
  {
    id: "pharmaceutical",
    name: "Pharmaceutical-inspired",
    blurb: "The precise, regulated look — without any regulatory claims.",
    research: false,
    categories: ["pharmaceutical", "clinical"],
    vibes: { clinical: 3, minimal: 1 },
    suggestedSlots: ["lot", "expiry", "storage", "warning"],
    suggestsNotice: false,
    suggestsQr: false,
    defaultStyleId: "pharma",
  },
  {
    id: "biotechnology",
    name: "Biotechnology",
    blurb: "Modern, engineered, science-forward branding.",
    research: true,
    categories: ["biotechnology", "laboratory"],
    vibes: { futuristic: 2, clinical: 1, premium: 1 },
    suggestedSlots: RESEARCH_SLOTS,
    suggestsNotice: true,
    suggestsQr: true,
    defaultStyleId: "futuristic",
  },
  {
    id: "medical-office",
    name: "Medical office",
    blurb: "Clean, trustworthy labels for practice supplies.",
    research: false,
    categories: ["clinical", "plain"],
    vibes: { clinical: 3, minimal: 1 },
    suggestedSlots: ["lot", "expiry", "storage"],
    suggestsNotice: false,
    suggestsQr: false,
    defaultStyleId: "clean-clinical",
  },
  {
    id: "skincare",
    name: "Skincare serum",
    blurb: "Shelf-ready beauty with ingredients and directions.",
    research: false,
    categories: ["beauty", "glossy", "plain"],
    vibes: { luxury: 1, minimal: 2 },
    suggestedSlots: ["subtitle", "description", "ingredients", "directions"],
    suggestsNotice: false,
    suggestsQr: false,
    defaultStyleId: "skincare-beauty",
  },
  {
    id: "cosmetic",
    name: "Cosmetic product",
    blurb: "Premium looks for cosmetic packaging.",
    research: false,
    categories: ["beauty", "luxury", "glossy"],
    vibes: { luxury: 2, premium: 1 },
    suggestedSlots: ["subtitle", "ingredients", "website"],
    suggestsNotice: false,
    suggestsQr: false,
    defaultStyleId: "luxury",
  },
  {
    id: "wellness",
    name: "Wellness product",
    blurb: "Friendly, clean, and easy to read.",
    research: false,
    categories: ["plain", "botanical", "beauty"],
    vibes: { minimal: 2, botanical: 1 },
    suggestedSlots: ["subtitle", "description", "directions"],
    suggestsNotice: false,
    suggestsQr: false,
    defaultStyleId: "minimal",
  },
  {
    id: "essential-oil",
    name: "Essential oil",
    blurb: "Botanical warmth for dropper bottles.",
    research: false,
    categories: ["botanical", "plain"],
    vibes: { botanical: 3 },
    suggestedSlots: ["subtitle", "volume", "warning"],
    suggestsNotice: false,
    suggestsQr: false,
    defaultStyleId: "botanical",
  },
  {
    id: "supplement",
    name: "Supplement packaging",
    blurb: "Ingredients, directions, and warnings that stay legible.",
    research: false,
    categories: ["plain", "clinical", "beauty"],
    vibes: { bold: 1, clinical: 1 },
    suggestedSlots: ["ingredients", "directions", "warning", "lot", "expiry"],
    suggestsNotice: false,
    suggestsQr: false,
  },
  {
    id: "botanical",
    name: "Botanical / apothecary",
    blurb: "Hand-crafted, natural, heritage character.",
    research: false,
    categories: ["botanical", "luxury"],
    vibes: { botanical: 3, luxury: 1 },
    suggestedSlots: ["subtitle", "description"],
    suggestsNotice: false,
    suggestsQr: false,
    defaultStyleId: "botanical",
  },
  {
    id: "general",
    name: "General product",
    blurb: "A professional label for anything else.",
    research: false,
    categories: [],
    vibes: {},
    suggestedSlots: [],
    suggestsNotice: false,
    suggestsQr: false,
  },
  {
    id: "custom",
    name: "Custom",
    blurb: "Start neutral and shape it yourself.",
    research: false,
    categories: [],
    vibes: {},
    suggestedSlots: [],
    suggestsNotice: false,
    suggestsQr: false,
  },
] as const;

export function getIndustry(id: string | undefined | null): IndustryDef | undefined {
  return INDUSTRIES.find((i) => i.id === id);
}

export function isResearchIndustry(id: string | undefined | null): boolean {
  return getIndustry(id)?.research ?? false;
}
