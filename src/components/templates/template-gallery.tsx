"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ALL_TEMPLATES } from "@/lib/templates/registry";
import { TEMPLATE_CATEGORIES, type TemplateCategoryId } from "@/lib/templates/types";
import { getVialPreset, VIAL_PRESETS } from "@/lib/vials/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TemplatePreview } from "./template-preview";

type CategoryFilter = TemplateCategoryId | "all";

export function TemplateGallery({ compact = false }: { compact?: boolean }) {
  const [category, setCategory] = React.useState<CategoryFilter>("all");
  const [presetFilter, setPresetFilter] = React.useState<string>("all");

  const filtered = ALL_TEMPLATES.filter(
    (t) =>
      (category === "all" || t.categories.includes(category)) &&
      (presetFilter === "all" || t.presetId === presetFilter),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter templates by style"
        >
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All styles"
          />
          {TEMPLATE_CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.name}
            />
          ))}
        </div>
        <div className="ml-auto">
          <Select value={presetFilter} onValueChange={setPresetFilter}>
            <SelectTrigger className="h-8 w-48 text-xs" aria-label="Filter by vial">
              {presetFilter === "all"
                ? "All vial sizes"
                : (getVialPreset(presetFilter)?.name ?? "All vial sizes")}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vial sizes</SelectItem>
              {VIAL_PRESETS.filter((p) => !p.isCustom).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No templates match those filters yet.
        </p>
      ) : (
        <ul
          className={cn(
            "grid gap-5",
            compact
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          )}
        >
          {filtered.map((template) => {
            const preset = getVialPreset(template.presetId);
            return (
              <li
                key={template.id}
                className="group overflow-hidden rounded-xl border border-border bg-surface shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex h-40 items-center justify-center bg-canvas-backdrop p-4">
                  <TemplatePreview
                    templateId={template.id}
                    doc={template.doc}
                    alt={`${template.name} template preview`}
                    className="max-h-full max-w-full drop-shadow"
                  />
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold leading-tight">
                        {template.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {template.brand} · {preset?.name}
                      </p>
                    </div>
                    {template.premium && <Badge variant="accent">Pro</Badge>}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {template.description}
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/editor/new?template=${template.id}`}>
                      Use this template
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
