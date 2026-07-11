import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PLAN_SEED,
  formatPlanPrice,
  type PlanDef,
  type PlanEntitlements,
} from "@/lib/billing/plan-seed";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Forge Labels plans: start free, go Pro for print-ready PDFs and premium finishes, or choose Business for teams, CSV batch labels, and production layers.",
};

function planHref(plan: PlanDef): string {
  switch (plan.id) {
    case "free":
      return "/dashboard";
    case "enterprise":
      return "mailto:hello@forgelabels.example";
    default:
      return "/signup";
  }
}

function formatStorage(mb: number): string {
  return mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`;
}

function BoolCell({ included }: { included: boolean }) {
  return included ? (
    <span role="img" aria-label="Included" className="font-medium text-primary">
      ✓
    </span>
  ) : (
    <span role="img" aria-label="Not included" className="text-muted-foreground/60">
      —
    </span>
  );
}

interface ComparisonRow {
  label: string;
  cell: (e: PlanEntitlements) => React.ReactNode;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Saved projects",
    cell: (e) => (e.maxProjects === null ? "Unlimited" : String(e.maxProjects)),
  },
  { label: "Storage", cell: (e) => formatStorage(e.maxStorageMb) },
  { label: "Team members", cell: (e) => String(e.maxTeamMembers) },
  { label: "High-res 600 DPI export", cell: (e) => <BoolCell included={e.hiResExport} /> },
  { label: "Print-ready PDF", cell: (e) => <BoolCell included={e.printReadyPdf} /> },
  { label: "SVG vector export", cell: (e) => <BoolCell included={e.svgExport} /> },
  { label: "Premium templates", cell: (e) => <BoolCell included={e.premiumTemplates} /> },
  { label: "Special finishes", cell: (e) => <BoolCell included={e.finishes} /> },
  { label: "Brand kits", cell: (e) => <BoolCell included={e.brandKits} /> },
  { label: "QR & barcodes", cell: (e) => <BoolCell included={e.qrAndBarcodes} /> },
  {
    label: "Watermark-free mockups",
    cell: (e) => <BoolCell included={!e.watermarkedMockups} />,
  },
  { label: "Version history", cell: (e) => <BoolCell included={e.versionHistory} /> },
  { label: "CSV batch labels", cell: (e) => <BoolCell included={e.csvBatch} /> },
  { label: "Production layers", cell: (e) => <BoolCell included={e.productionLayers} /> },
  {
    label: "Commercial template use",
    cell: (e) => <BoolCell included={e.commercialTemplateUse} />,
  },
  { label: "Priority support", cell: (e) => <BoolCell included={e.prioritySupport} /> },
];

const BILLING_FAQ = [
  {
    q: "How do upgrades and downgrades work?",
    a: "Upgrades take effect immediately: Stripe prorates the difference, so you only pay for the remainder of the current billing period at the new rate. Downgrades take effect at the end of the period you have already paid for — you keep the higher plan until then.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal whenever you like — there is no cancellation fee or lock-in. Your plan stays active until the end of the period you have paid for, and you are not charged again.",
  },
  {
    q: "What happens to my projects if I downgrade?",
    a: "Nothing is ever deleted. If you end up with more projects than your new plan allows, the extra projects simply become read-only — you can still open, view, and export what your plan permits, and they become editable again if you upgrade or free up slots.",
  },
  {
    q: "How are payments handled?",
    a: "All payments are processed by Stripe. Card details go directly to Stripe and never touch our servers. You can update your payment method, download invoices, and manage your subscription from the Stripe billing portal linked in your account settings.",
  },
  {
    q: "What currency are prices in? What about taxes?",
    a: "All prices are in US dollars. Depending on your location, VAT, GST, or sales tax may be added at checkout. If you pay with a card in another currency, your card issuer performs the conversion at its own rate.",
  },
  {
    q: "Is there a refund policy?",
    a: "Yes — first-time subscription purchases are refundable within 14 days if you have not produced high-resolution exports, and EU/UK statutory rights are unaffected. The full details are in our Refund Policy.",
  },
  {
    q: "Do I need a credit card to use the Free plan?",
    a: "No. The Free plan requires no payment details, and the editor and size calculator can even be tried without an account.",
  },
] as const;

export default function PricingPage() {
  const paidPlans = PLAN_SEED.flatMap((p) =>
    p.priceMonthlyCents && p.priceYearlyCents
      ? [{ name: p.name, monthly: p.priceMonthlyCents, yearly: p.priceYearlyCents }]
      : [],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Intro */}
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Plans for every stage of your product line
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Design and print your first labels for free. Upgrade when you need
          print-ready PDFs, premium finishes, brand kits, or batch production.
        </p>
      </div>

      {/* Plan cards */}
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_SEED.map((plan) => (
          <Card
            key={plan.id}
            className={
              plan.highlighted ? "flex flex-col border-primary shadow-md" : "flex flex-col"
            }
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.highlighted && <Badge>Most popular</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{plan.blurb}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <p className="font-display text-3xl font-bold">
                {formatPlanPrice(plan.priceMonthlyCents)}
                {plan.priceMonthlyCents ? (
                  <span className="text-sm font-normal text-muted-foreground"> /month</span>
                ) : null}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-primary" aria-hidden>
                      ✓
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6 w-full"
                variant={plan.highlighted ? "primary" : "outline"}
              >
                {plan.id === "enterprise" ? (
                  <a href={planHref(plan)}>{plan.cta}</a>
                ) : (
                  <Link href={planHref(plan)}>
                    {plan.cta}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Yearly billing saves ~17%
        {paidPlans.length > 0 && (
          <>
            {" — "}
            {paidPlans
              .map(
                (p) =>
                  `${p.name} works out to ${formatPlanPrice(p.yearly)}/month billed yearly`,
              )
              .join(", ")}
            .
          </>
        )}
      </p>

      {/* Comparison table */}
      <section className="mt-16" aria-labelledby="compare-heading">
        <h2
          id="compare-heading"
          className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Compare plans in detail
        </h2>
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle/60 text-left">
                <th scope="col" className="p-3 font-semibold">
                  Feature
                </th>
                {PLAN_SEED.map((plan) => (
                  <th scope="col" key={plan.id} className="p-3 text-center font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-b-0">
                  <th scope="row" className="p-3 text-left font-normal text-foreground">
                    {row.label}
                  </th>
                  {PLAN_SEED.map((plan) => (
                    <td
                      key={plan.id}
                      className="p-3 text-center text-muted-foreground"
                    >
                      {row.cell(plan.entitlements)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Free-plan mockup exports carry a small watermark; design exports do
          not. Full plan terms are in the{" "}
          <Link href="/legal/subscription-policy" className="text-primary hover:underline">
            Subscription Policy
          </Link>
          .
        </p>
      </section>

      {/* Billing FAQ */}
      <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="billing-faq-heading">
        <h2
          id="billing-faq-heading"
          className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Billing questions, answered
        </h2>
        <Accordion type="single" collapsible className="mt-8">
          {BILLING_FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-4 text-sm text-muted-foreground">
          More detail: read the{" "}
          <Link href="/legal/subscription-policy" className="text-primary hover:underline">
            Subscription Policy
          </Link>{" "}
          and the{" "}
          <Link href="/legal/refunds" className="text-primary hover:underline">
            Refund Policy
          </Link>
          .
        </p>
      </section>

      <Callout variant="info" title="About billing availability" className="mt-16">
        Paid subscriptions activate when a workspace has Stripe configured. In
        local demo mode — running Forge Labels without cloud services — there is
        nothing to bill, and all features are available for evaluation.
      </Callout>
    </div>
  );
}
