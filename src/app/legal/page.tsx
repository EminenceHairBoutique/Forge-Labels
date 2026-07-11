import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Legal & policies",
  description:
    "All Forge Labels policies in one place: Terms of Service, Privacy, Cookies, Acceptable Use, IP & Content, Refunds, Subscriptions, Print Accuracy, and Regulatory Disclaimer.",
};

const POLICIES = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    description: "The agreement that governs your use of Forge Labels.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    description: "What data we collect, how it is used, and your rights over it.",
  },
  {
    href: "/legal/cookies",
    title: "Cookie Policy",
    description: "The cookies and browser storage we use, and how to control them.",
  },
  {
    href: "/legal/acceptable-use",
    title: "Acceptable Use Policy",
    description: "What you may not create or do with the service.",
  },
  {
    href: "/legal/ip-policy",
    title: "IP & Content Policy",
    description: "Who owns what: your designs, our templates, fonts, and takedowns.",
  },
  {
    href: "/legal/refunds",
    title: "Refund Policy",
    description: "When subscription payments are refundable and how to ask.",
  },
  {
    href: "/legal/subscription-policy",
    title: "Subscription Policy",
    description: "Billing cycles, upgrades, downgrades, cancellation, and limits.",
  },
  {
    href: "/legal/print-accuracy",
    title: "Print Accuracy Disclaimer",
    description: "Why screens differ from print, and why test prints are on you.",
  },
  {
    href: "/legal/regulatory",
    title: "Regulatory Disclaimer",
    description: "Label compliance is your responsibility — what that means.",
  },
] as const;

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Legal &amp; policies
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Everything that governs Forge Labels, written to be read. All
          policies were last updated in July 2026.
        </p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {POLICIES.map((policy) => (
          <Link key={policy.href} href={policy.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {policy.title}
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{policy.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Questions about any policy? Email{" "}
        <a
          href="mailto:hello@forgelabels.example"
          className="text-primary hover:underline"
        >
          hello@forgelabels.example
        </a>
        .
      </p>
    </div>
  );
}
