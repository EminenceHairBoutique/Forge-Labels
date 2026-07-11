/**
 * Subscription plan definitions.
 *
 * This module is the SEED for the `plans` + `plan_entitlements` tables and
 * the read-only fallback used in local demo mode. In cloud mode the billing
 * UI reads plans from the database (which admins can edit) — never from
 * constants — so pricing is not hardcoded into application logic.
 */

export interface PlanEntitlements {
  maxProjects: number | null; // null = unlimited
  maxStorageMb: number;
  maxTeamMembers: number;
  hiResExport: boolean;
  printReadyPdf: boolean;
  svgExport: boolean;
  premiumTemplates: boolean;
  finishes: boolean;
  brandKits: boolean;
  qrAndBarcodes: boolean;
  watermarkedMockups: boolean;
  versionHistory: boolean;
  csvBatch: boolean;
  productionLayers: boolean;
  commercialTemplateUse: boolean;
  prioritySupport: boolean;
}

export interface PlanDef {
  id: "free" | "pro" | "business" | "enterprise";
  name: string;
  blurb: string;
  /** USD cents per month billed monthly; null = custom/contact. */
  priceMonthlyCents: number | null;
  /** USD cents per month billed yearly; null = custom/contact. */
  priceYearlyCents: number | null;
  highlighted?: boolean;
  cta: string;
  highlights: string[];
  entitlements: PlanEntitlements;
}

export const PLAN_SEED: readonly PlanDef[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Design and print your first labels.",
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    cta: "Start free",
    highlights: [
      "Full design editor",
      "Standard vial presets & size calculator",
      "Starter templates",
      "PNG export at 300 DPI",
      "Print-sheet generator",
      "3 saved projects",
    ],
    entitlements: {
      maxProjects: 3,
      maxStorageMb: 100,
      maxTeamMembers: 1,
      hiResExport: false,
      printReadyPdf: false,
      svgExport: false,
      premiumTemplates: false,
      finishes: false,
      brandKits: false,
      qrAndBarcodes: true,
      watermarkedMockups: true,
      versionHistory: false,
      csvBatch: false,
      productionLayers: false,
      commercialTemplateUse: false,
      prioritySupport: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For brands shipping real products.",
    priceMonthlyCents: 1200,
    priceYearlyCents: 1000,
    highlighted: true,
    cta: "Go Pro",
    highlights: [
      "Everything in Free",
      "Full template library, commercial use",
      "Print-ready PDF with bleed & crop marks",
      "600 DPI + SVG vector export",
      "Holographic, foil & metallic finishes",
      "Brand kits & watermark-free mockups",
      "Unlimited projects + version history",
    ],
    entitlements: {
      maxProjects: null,
      maxStorageMb: 5_000,
      maxTeamMembers: 1,
      hiResExport: true,
      printReadyPdf: true,
      svgExport: true,
      premiumTemplates: true,
      finishes: true,
      brandKits: true,
      qrAndBarcodes: true,
      watermarkedMockups: false,
      versionHistory: true,
      csvBatch: false,
      productionLayers: false,
      commercialTemplateUse: true,
      prioritySupport: false,
    },
  },
  {
    id: "business",
    name: "Business",
    blurb: "For teams and batch production.",
    priceMonthlyCents: 3900,
    priceYearlyCents: 3200,
    cta: "Start Business",
    highlights: [
      "Everything in Pro",
      "5 team members with shared brand assets",
      "CSV batch label generation",
      "Dynamic data fields (lots, serials, QR)",
      "Special production layers (white ink, foil, spot UV)",
      "Priority support",
    ],
    entitlements: {
      maxProjects: null,
      maxStorageMb: 25_000,
      maxTeamMembers: 5,
      hiResExport: true,
      printReadyPdf: true,
      svgExport: true,
      premiumTemplates: true,
      finishes: true,
      brandKits: true,
      qrAndBarcodes: true,
      watermarkedMockups: false,
      versionHistory: true,
      csvBatch: true,
      productionLayers: true,
      commercialTemplateUse: true,
      prioritySupport: true,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "SSO, API access, and custom workflows.",
    priceMonthlyCents: null,
    priceYearlyCents: null,
    cta: "Contact us",
    highlights: [
      "Everything in Business",
      "Single sign-on (SSO)",
      "API access & custom integrations",
      "Private template libraries",
      "White-label deployment",
      "Audit logs & custom onboarding",
    ],
    entitlements: {
      maxProjects: null,
      maxStorageMb: 100_000,
      maxTeamMembers: 100,
      hiResExport: true,
      printReadyPdf: true,
      svgExport: true,
      premiumTemplates: true,
      finishes: true,
      brandKits: true,
      qrAndBarcodes: true,
      watermarkedMockups: false,
      versionHistory: true,
      csvBatch: true,
      productionLayers: true,
      commercialTemplateUse: true,
      prioritySupport: true,
    },
  },
] as const;

export function formatPlanPrice(cents: number | null): string {
  if (cents === null) return "Custom";
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
