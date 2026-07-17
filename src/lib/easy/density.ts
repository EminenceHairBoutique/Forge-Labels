import { isResearchIndustry } from "./industries";
import type { SlotId } from "./slots";

/**
 * Content-density modes (§11): named field SETS the user can switch
 * between without rearranging anything. Research industries get the
 * research vocabulary (lot/batch/catalog/science data); everything else
 * gets the general product ladder. The apply step intersects these with
 * the slots the current template actually carries and says so when
 * something has no home.
 */

export type DensityMode = "essential" | "standard" | "detailed";

export const DENSITY_MODES: readonly { id: DensityMode; name: string; blurb: string }[] = [
  { id: "essential", name: "Essential", blurb: "Just what identifies the product." },
  { id: "standard", name: "Standard", blurb: "The usual working label." },
  { id: "detailed", name: "Detailed", blurb: "Every technical field you've filled." },
];

const RESEARCH_ESSENTIAL: SlotId[] = [
  "brand",
  "product-name",
  "strength",
  "volume",
  "notice",
  "lot",
  "qr",
];
const RESEARCH_STANDARD: SlotId[] = [
  ...RESEARCH_ESSENTIAL,
  "catalog",
  "storage",
  "batch",
  "retest",
  "website",
];
const RESEARCH_DETAILED: SlotId[] = [
  ...RESEARCH_STANDARD,
  "formula",
  "molecular-weight",
  "cas",
  "sequence",
  "purity",
  "barcode",
  "coa",
];

const GENERAL_ESSENTIAL: SlotId[] = ["brand", "product-name", "strength", "volume"];
const GENERAL_STANDARD: SlotId[] = [
  ...GENERAL_ESSENTIAL,
  "subtitle",
  "description",
  "storage",
  "website",
  "lot",
];
const GENERAL_DETAILED: SlotId[] = [
  ...GENERAL_STANDARD,
  "ingredients",
  "directions",
  "warning",
  "expiry",
  "verification",
];

/**
 * The ideal slot set for a mode. Only slots the user has values for (or
 * that are required) actually materialize — the mode opens doors, it
 * doesn't invent content.
 */
export function densitySlotSet(
  mode: DensityMode,
  industry: string | undefined | null,
): ReadonlySet<SlotId> {
  const research = isResearchIndustry(industry);
  const table: Record<DensityMode, SlotId[]> = research
    ? {
        essential: RESEARCH_ESSENTIAL,
        standard: RESEARCH_STANDARD,
        detailed: RESEARCH_DETAILED,
      }
    : {
        essential: GENERAL_ESSENTIAL,
        standard: GENERAL_STANDARD,
        detailed: GENERAL_DETAILED,
      };
  return new Set(table[mode]);
}
