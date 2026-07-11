/** Central site metadata and navigation used by marketing pages and footers. */

export const SITE = {
  name: "Forge Labels",
  tagline: "Design professional vial labels in minutes.",
  description:
    "The specialized design studio for 10 mL, 20 mL, and 30 mL vial labels — dimension-accurate canvases, realistic mockups, and print-ready exports.",
} as const;

export const MARKETING_NAV = [
  { href: "/features", label: "Features" },
  { href: "/templates", label: "Templates" },
  { href: "/pricing", label: "Pricing" },
  { href: "/guides/vial-sizes", label: "Guides" },
  { href: "/help", label: "Help" },
] as const;

export const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/templates", label: "Template library" },
      { href: "/pricing", label: "Pricing" },
      { href: "/tools/label-calculator", label: "Label size calculator" },
      { href: "/dashboard", label: "Open the studio" },
    ],
  },
  {
    title: "Guides",
    links: [
      { href: "/guides/vial-sizes", label: "Vial size guide" },
      { href: "/guides/printing", label: "Printing guide" },
      { href: "/guides/materials", label: "Materials & finishes" },
      { href: "/help", label: "Help center" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/acceptable-use", label: "Acceptable Use" },
      { href: "/legal/print-accuracy", label: "Print Accuracy Disclaimer" },
      { href: "/legal/regulatory", label: "Regulatory Disclaimer" },
      { href: "/legal", label: "All policies" },
    ],
  },
] as const;

/**
 * The compliance notice the spec requires to be visible platform-wide.
 * Rendered in the marketing footer and linked from export/print flows.
 */
export const COMPLIANCE_NOTICE =
  "You are responsible for the accuracy and legality of your labels: verify dimensions against your actual vial, confirm all legally required warnings, ingredients, identifiers, and claims for your product category and jurisdiction, and respect trademarks. On-screen colors and simulated finishes can differ from printed output. Forge Labels does not certify compliance with FDA, FTC, pharmaceutical, cosmetic, supplement, laboratory, or other regulatory requirements.";
