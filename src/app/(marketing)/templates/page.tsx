import type { Metadata } from "next";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { ALL_TEMPLATES } from "@/lib/templates/registry";

export const metadata: Metadata = {
  title: "Template library",
  description:
    "Professionally designed vial label templates — minimal clinical, luxury, botanical, pharma-inspired, and more. Every template is fully editable.",
};

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Template library
        </h1>
        <p className="mt-3 text-muted-foreground">
          {ALL_TEMPLATES.length} designer-made starting points across our
          fictional demo brands. Pick one, and it rescales to your exact vial —
          then every object stays editable.
        </p>
      </div>
      <div className="mt-10">
        <TemplateGallery />
      </div>
    </div>
  );
}
