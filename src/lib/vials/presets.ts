import type { LabelStyle } from "@/lib/geometry/label-calculator";

/**
 * Vial preset profiles.
 *
 * Dimensions are typical manufacturer values for each container class and are
 * intentionally editable everywhere they appear — the same nominal volume
 * varies between suppliers, so the UI always tells users to measure the
 * exact vial before printing.
 */

export type CapStyle =
  | "crimp"
  | "flip-off"
  | "screw"
  | "dropper"
  | "pump"
  | "none";

export type GlassColor = "clear" | "amber" | "cobalt" | "frosted" | "opaque";

export interface VialPreset {
  id: string;
  name: string;
  nominalVolumeMl: number | null;
  /** Body diameter at the label area. */
  diameterMm: number;
  /** Height of the straight cylindrical wall usable for a label. */
  straightWallHeightMm: number;
  /** Overall container height including closure. */
  totalHeightMm: number;
  capStyle: CapStyle;
  capHeightMm: number;
  capDiameterMm: number;
  neckDiameterMm: number;
  defaultGlass: GlassColor;
  defaultLabelStyle: LabelStyle;
  description: string;
  /** True for the "start from scratch" profile. */
  isCustom?: boolean;
}

export const VIAL_PRESETS: readonly VialPreset[] = [
  {
    id: "10ml-serum",
    name: "10 mL serum vial",
    nominalVolumeMl: 10,
    diameterMm: 24.5,
    straightWallHeightMm: 30,
    totalHeightMm: 45,
    capStyle: "flip-off",
    capHeightMm: 13,
    capDiameterMm: 20,
    neckDiameterMm: 20,
    defaultGlass: "clear",
    defaultLabelStyle: "full-wrap",
    description:
      "Molded glass serum vial in the ISO 10R format with a 20 mm crimp neck and flip-off cap.",
  },
  {
    id: "10ml-crimp",
    name: "10 mL crimp-top vial",
    nominalVolumeMl: 10,
    diameterMm: 23.75,
    straightWallHeightMm: 32,
    totalHeightMm: 46.5,
    capStyle: "crimp",
    capHeightMm: 8,
    capDiameterMm: 20,
    neckDiameterMm: 20,
    defaultGlass: "clear",
    defaultLabelStyle: "full-wrap",
    description:
      "Tubular glass vial with a 20 mm crimp-seal aluminum closure, common for injectables and lab samples.",
  },
  {
    id: "10ml-dropper",
    name: "10 mL dropper bottle",
    nominalVolumeMl: 10,
    diameterMm: 23.5,
    straightWallHeightMm: 38,
    totalHeightMm: 72,
    capStyle: "dropper",
    capHeightMm: 30,
    capDiameterMm: 17,
    neckDiameterMm: 18,
    defaultGlass: "amber",
    defaultLabelStyle: "full-wrap",
    description:
      "European-style round dropper bottle (DIN 18 neck) used for essential oils, tinctures, and serums.",
  },
  {
    id: "20ml-serum",
    name: "20 mL serum vial",
    nominalVolumeMl: 20,
    diameterMm: 30,
    straightWallHeightMm: 35,
    totalHeightMm: 55,
    capStyle: "flip-off",
    capHeightMm: 13,
    capDiameterMm: 20,
    neckDiameterMm: 20,
    defaultGlass: "clear",
    defaultLabelStyle: "full-wrap",
    description:
      "Molded glass serum vial in the ISO 20R format with a 20 mm crimp neck and flip-off cap.",
  },
  {
    id: "20ml-injection",
    name: "20 mL injection-style vial",
    nominalVolumeMl: 20,
    diameterMm: 30.75,
    straightWallHeightMm: 38,
    totalHeightMm: 58,
    capStyle: "crimp",
    capHeightMm: 8,
    capDiameterMm: 20,
    neckDiameterMm: 20,
    defaultGlass: "clear",
    defaultLabelStyle: "full-wrap",
    description:
      "Tubular clear-glass injection vial with a 20 mm crimp closure and rubber stopper.",
  },
  {
    id: "30ml-serum",
    name: "30 mL serum bottle",
    nominalVolumeMl: 30,
    diameterMm: 34.5,
    straightWallHeightMm: 45,
    totalHeightMm: 73,
    capStyle: "pump",
    capHeightMm: 25,
    capDiameterMm: 22,
    neckDiameterMm: 20,
    defaultGlass: "frosted",
    defaultLabelStyle: "full-wrap",
    description:
      "Cosmetic 30 mL (1 oz) round serum bottle with a treatment pump or screw cap, common for skincare.",
  },
  {
    id: "30ml-dropper",
    name: "30 mL dropper bottle",
    nominalVolumeMl: 30,
    diameterMm: 34.5,
    straightWallHeightMm: 42,
    totalHeightMm: 95,
    capStyle: "dropper",
    capHeightMm: 35,
    capDiameterMm: 20,
    neckDiameterMm: 18,
    defaultGlass: "amber",
    defaultLabelStyle: "full-wrap",
    description:
      "Boston-round 30 mL dropper bottle (DIN 18 neck) used for oils, tinctures, and cosmetic serums.",
  },
  {
    id: "2ml-cryo",
    name: "2 mL cryovial",
    nominalVolumeMl: 2,
    diameterMm: 12.5,
    straightWallHeightMm: 30,
    totalHeightMm: 49,
    capStyle: "screw",
    capHeightMm: 9,
    capDiameterMm: 13.5,
    neckDiameterMm: 11,
    defaultGlass: "clear",
    defaultLabelStyle: "full-wrap",
    description:
      "Self-standing 2 mL cryogenic vial with an external-thread screw cap, used for frozen sample storage.",
  },
  {
    id: "5ml-serum",
    name: "5 mL serum vial",
    nominalVolumeMl: 5,
    diameterMm: 22,
    straightWallHeightMm: 22,
    totalHeightMm: 40,
    capStyle: "flip-off",
    capHeightMm: 13,
    capDiameterMm: 20,
    neckDiameterMm: 20,
    defaultGlass: "clear",
    defaultLabelStyle: "full-wrap",
    description:
      "Compact 5 mL serum vial with a 20 mm crimp neck and flip-off cap — the small sibling of the 10 mL format.",
  },
  {
    id: "50ml-centrifuge",
    name: "50 mL centrifuge tube",
    nominalVolumeMl: 50,
    diameterMm: 29,
    straightWallHeightMm: 75,
    totalHeightMm: 115,
    capStyle: "screw",
    capHeightMm: 14,
    capDiameterMm: 32,
    neckDiameterMm: 28,
    defaultGlass: "clear",
    defaultLabelStyle: "partial-wrap",
    description:
      "Conical-bottom 50 mL centrifuge tube with a wide screw cap; the label sits on the straight upper wall.",
  },
  {
    id: "custom",
    name: "Custom cylindrical container",
    nominalVolumeMl: null,
    diameterMm: 25,
    straightWallHeightMm: 40,
    totalHeightMm: 60,
    capStyle: "screw",
    capHeightMm: 12,
    capDiameterMm: 22,
    neckDiameterMm: 20,
    defaultGlass: "clear",
    defaultLabelStyle: "full-wrap",
    description:
      "Start from your own measurements for any cylindrical vial, bottle, or tube.",
    isCustom: true,
  },
] as const;

export function getVialPreset(id: string): VialPreset | undefined {
  return VIAL_PRESETS.find((p) => p.id === id);
}

export const DEFAULT_VIAL_PRESET_ID = "10ml-serum";
