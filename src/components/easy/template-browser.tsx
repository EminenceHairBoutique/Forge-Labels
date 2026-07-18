"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart, SlidersHorizontal, X } from "lucide-react";
import type { LabelDocument } from "@/lib/document/schema";
import {
  EASY_TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateFitsVial,
  templatePrefersDark,
  type ContentDensity,
  type EasyTemplateDef,
  type TemplateCategory,
} from "@/lib/easy/templates";
import {
  getMaterial,
  getMaterialOption,
  type MaterialDef,
  type MaterialOption,
} from "@/lib/easy/materials";
import { getEasyPalette, type EasyPalette } from "@/lib/easy/palettes";
import { pickPalette } from "@/lib/easy/recommend";
import { buildEasyLabel } from "@/lib/easy/instantiate";
import {
  buildEasyDocument,
  DEFAULT_ENABLED,
  defaultEasyFields,
} from "@/lib/easy/create-doc";
import { applyEasyChange, ensureEasyFonts, readEasyState } from "@/lib/easy/fields";
import type { SlotId } from "@/lib/easy/slots";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { renderThumbnail } from "@/lib/export/raster";
import { getVialPreset } from "@/lib/vials/presets";
import { getStorageAdapter } from "@/lib/storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { VialStage } from "./vial-stage";
import { cn } from "@/lib/utils";

/**
 * The template browser (§14): mockup-first cards over the REAL layout
 * engine and export renderer — never colored placeholders. Thumbnails
 * render lazily (IntersectionObserver) into a module-level cache so
 * scrolling 45+ cards stays smooth and re-opening is instant. One
 * interactive 3D preview lives in the detail view only.
 */

// ---------------------------------------------------------------------------
// Thumbnail cache
// ---------------------------------------------------------------------------

const thumbCache = new Map<string, Promise<string>>();
const THUMB_CACHE_MAX = 240;

function thumbnailFor(
  key: string,
  build: () => Promise<string>,
): Promise<string> {
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const promise = build().catch((err) => {
    thumbCache.delete(key);
    throw err;
  });
  if (thumbCache.size >= THUMB_CACHE_MAX) {
    const oldest = thumbCache.keys().next().value;
    if (oldest) thumbCache.delete(oldest);
  }
  thumbCache.set(key, promise);
  return promise;
}

interface PreviewContext {
  baseDoc: LabelDocument;
  material: MaterialDef;
  option: MaterialOption;
  intensity: "subtle" | "balanced" | "bold" | "maximum";
  fields: Partial<Record<SlotId, string>>;
  enabled: ReadonlySet<SlotId>;
  pairingId?: string;
}

/** Build the template preview doc (same engine, same renderer as exports). */
async function buildPreview(
  template: EasyTemplateDef,
  palette: EasyPalette,
  ctx: PreviewContext,
  maxPx: number,
): Promise<string> {
  await ensureEasyFonts(template, ctx.pairingId);
  const build = buildEasyLabel({
    template,
    widthMm: ctx.baseDoc.label.widthMm,
    heightMm: ctx.baseDoc.label.heightMm,
    bleedMm: ctx.baseDoc.label.bleedMm,
    safeMm: ctx.baseDoc.label.safeMm,
    material: ctx.material,
    option: ctx.option,
    intensity: ctx.intensity,
    palette,
    fields: ctx.fields,
    enabled: ctx.enabled,
    measure: measureTextHeightMm,
  });
  const doc: LabelDocument = {
    ...ctx.baseDoc,
    background: build.background,
    substrateId: build.substrateId,
    objects: build.objects,
  };
  return renderThumbnail(doc, maxPx);
}

function TemplateThumb({
  template,
  palette,
  ctx,
  cacheSalt,
  className,
}: {
  template: EasyTemplateDef;
  palette: EasyPalette;
  ctx: PreviewContext;
  cacheSalt: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const key = `${template.id}|${palette.id}|${cacheSalt}`;

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let alive = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      thumbnailFor(key, () => buildPreview(template, palette, ctx, 420))
        .then((dataUrl) => {
          if (alive) setUrl(dataUrl);
        })
        .catch(() => {});
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => {
      alive = false;
      observer.disconnect();
    };
    // ctx object identity is stable per browser mount; key captures content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg bg-canvas-backdrop p-2",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated preview
        <img
          src={url}
          alt={`${template.name} design preview`}
          className="max-h-full max-w-full rounded-sm object-contain shadow-md"
        />
      ) : (
        <Skeleton className="h-full w-full rounded-md" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Favorites (localStorage)
// ---------------------------------------------------------------------------

const FAVS_KEY = "forge-labels:template-favs:v1";

function readFavs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(FAVS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// The browser
// ---------------------------------------------------------------------------

type Tone = "all" | "light" | "dark";

export interface TemplateBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Editor mode: the open document — picking applies the template to it.
   * Absent: create mode — picking builds a fresh label and opens it.
   */
  doc?: LabelDocument;
}

export function TemplateBrowser({ open, onOpenChange, doc }: TemplateBrowserProps) {
  const router = useRouter();
  const [category, setCategory] = React.useState<TemplateCategory | "all">("all");
  const [tone, setTone] = React.useState<Tone>("all");
  const [density, setDensity] = React.useState<ContentDensity | "all">("all");
  const [onlyFavs, setOnlyFavs] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [favs, setFavs] = React.useState<Set<string>>(readFavs);
  const [detail, setDetail] = React.useState<EasyTemplateDef | null>(null);
  const [busy, setBusy] = React.useState(false);

  // --- Context: geometry, material, palette, words -----------------------------
  const ctx = React.useMemo<PreviewContext | null>(() => {
    if (doc?.easy) {
      const material = getMaterial(doc.easy.materialId);
      if (!material) return null;
      const state = readEasyState(doc);
      return {
        baseDoc: doc,
        material,
        option: getMaterialOption(material, doc.easy.materialOptionId),
        intensity: doc.easy.intensity ?? material.defaultIntensity,
        fields: state?.fields ?? defaultEasyFields(),
        enabled: state?.enabled ?? DEFAULT_ENABLED,
        pairingId: doc.easy.pairingId,
      };
    }
    const preset = getVialPreset("10ml-serum");
    const material = getMaterial("plain");
    if (!preset || !material) return null;
    const base = buildEasyDocument({
      preset,
      templateId: EASY_TEMPLATES[0]!.id,
      materialId: material.id,
      materialOptionId: material.defaultOptionId,
      paletteId: material.defaultPaletteId,
      fields: defaultEasyFields(),
      enabled: DEFAULT_ENABLED,
    });
    return {
      baseDoc: base,
      material,
      option: getMaterialOption(material, material.defaultOptionId),
      intensity: material.defaultIntensity,
      fields: defaultEasyFields(),
      enabled: DEFAULT_ENABLED,
    };
  // Rebuild when the document's design inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doc?.easy?.materialId,
    doc?.easy?.materialOptionId,
    doc?.easy?.intensity,
    doc?.easy?.paletteId,
    doc?.easy?.pairingId,
    doc?.label.widthMm,
    doc?.label.heightMm,
    open,
  ]);

  const cacheSalt = React.useMemo(() => {
    if (!ctx) return "";
    const words = `${ctx.fields.brand ?? ""}|${ctx.fields["product-name"] ?? ""}|${ctx.fields.strength ?? ""}`;
    return `${ctx.baseDoc.label.widthMm}x${ctx.baseDoc.label.heightMm}|${ctx.material.id}|${ctx.option.id}|${ctx.intensity}|${ctx.pairingId ?? "-"}|${words}`;
  }, [ctx]);

  if (!ctx) return null;

  // --- Eligibility & filtering ---------------------------------------------------
  const { widthMm, heightMm } = ctx.baseDoc.label;
  const eligible = EASY_TEMPLATES.filter((t) => {
    if (t.materials !== "all" && !t.materials.includes(ctx.material.id)) return false;
    if (!templateFitsVial(t, ctx.baseDoc.vial.presetId)) return false;
    if (t.minHeightMm && heightMm < t.minHeightMm) return false;
    if (t.minWidthMm && widthMm < t.minWidthMm) return false;
    return true;
  });
  const hidden = EASY_TEMPLATES.length - eligible.length;

  const needle = query.trim().toLowerCase();
  const filtered = eligible.filter((t) => {
    if (category !== "all" && !t.category.includes(category)) return false;
    if (tone !== "all" && (templatePrefersDark(t) ? "dark" : "light") !== tone) return false;
    if (density !== "all" && t.density !== density) return false;
    if (onlyFavs && !favs.has(t.id)) return false;
    if (
      needle &&
      ![t.name, t.familyName, ...t.mood, ...t.category]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    ) {
      return false;
    }
    return true;
  });
  const anyFilter =
    category !== "all" || tone !== "all" || density !== "all" || onlyFavs || needle.length > 0;

  const featured = filtered.filter((t) => t.featured);
  const sections: { title: string; items: EasyTemplateDef[] }[] = anyFilter
    ? [{ title: `${filtered.length} template${filtered.length === 1 ? "" : "s"}`, items: filtered }]
    : [
        { title: "Featured", items: featured },
        ...TEMPLATE_CATEGORIES.map((cat) => ({
          title: CATEGORY_LABELS[cat],
          items: filtered.filter((t) => t.category[0] === cat),
        })),
      ].filter((s) => s.items.length > 0);

  const paletteFor = (t: EasyTemplateDef): EasyPalette => {
    // Keep the user's palette when the material offers it; otherwise the
    // best tone match for the template (same rule the recommender uses).
    if (doc?.easy && ctx.material.paletteIds.includes(doc.easy.paletteId)) {
      return getEasyPalette(doc.easy.paletteId);
    }
    return pickPalette(ctx.material, t, null);
  };

  const toggleFav = (id: string) => {
    const next = new Set(favs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavs(next);
    try {
      window.localStorage.setItem(FAVS_KEY, JSON.stringify([...next]));
    } catch {
      // storage full/blocked — favorites just don't persist
    }
  };

  async function use(template: EasyTemplateDef) {
    setBusy(true);
    try {
      if (doc?.easy) {
        await applyEasyChange({ templateId: template.id });
        setDetail(null);
        onOpenChange(false);
      } else {
        await ensureEasyFonts(template);
        const preset = getVialPreset("10ml-serum")!;
        const material = ctx!.material;
        const created = buildEasyDocument(
          {
            preset,
            templateId: template.id,
            materialId: material.id,
            materialOptionId: ctx!.option.id,
            paletteId: paletteFor(template).id,
            fields: defaultEasyFields(),
            enabled: DEFAULT_ENABLED,
          },
          measureTextHeightMm,
        );
        const project = await getStorageAdapter().createProject({
          name: template.name,
          doc: created,
        });
        router.push(`/easy/${project.id}`);
      }
    } catch (err) {
      toast.error(
        "Couldn't use this template",
        err instanceof Error ? err.message : undefined,
      );
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[min(100vw-1rem,72rem)] max-w-none flex-col overflow-hidden p-0 sm:max-h-[88dvh]">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            Every preview is your label — your size, material, and words.
            {hidden > 0 &&
              ` ${hidden} template${hidden === 1 ? "" : "s"} need${hidden === 1 ? "s" : ""} a bigger label and ${hidden === 1 ? "is" : "are"} hidden.`}
          </DialogDescription>
        </DialogHeader>

        {/* Filter bar (collapses to a bottom sheet on phones). */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            className="h-8 w-36 text-xs sm:w-48"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs sm:hidden"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filters
          </Button>
          <div
            className={cn(
              "gap-2 sm:flex sm:flex-wrap sm:items-center",
              filtersOpen
                ? "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-border bg-background p-4 pb-6 shadow-2xl sm:static sm:z-auto sm:flex-row sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
                : "hidden",
            )}
          >
            {filtersOpen && (
              <div className="flex items-center justify-between sm:hidden">
                <p className="text-sm font-medium">Filters</p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close filters"
                  onClick={() => setFiltersOpen(false)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            )}
            <FilterSelect
              label="Style"
              value={category}
              onChange={(v) => setCategory(v as TemplateCategory | "all")}
              options={[
                { value: "all", label: "All styles" },
                ...TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
              ]}
            />
            <FilterSelect
              label="Light or dark"
              value={tone}
              onChange={(v) => setTone(v as Tone)}
              options={[
                { value: "all", label: "Light & dark" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <FilterSelect
              label="Information"
              value={density}
              onChange={(v) => setDensity(v as ContentDensity | "all")}
              options={[
                { value: "all", label: "Any amount" },
                { value: "minimal", label: "Just the basics" },
                { value: "standard", label: "Standard" },
                { value: "detailed", label: "Lots of details" },
              ]}
            />
            <Button
              variant={onlyFavs ? "primary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              aria-pressed={onlyFavs}
              onClick={() => setOnlyFavs((o) => !o)}
            >
              <Heart className={cn("size-3.5", onlyFavs && "fill-current")} aria-hidden />
              Favorites
            </Button>
          </div>
        </div>

        {/* Card grid. content-visibility keeps offscreen sections cheap. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="mb-6 [content-visibility:auto]"
              aria-label={section.title}
            >
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {section.items.map((template) => (
                  <li key={`${section.title}-${template.id}`}>
                    <TemplateCard
                      template={template}
                      palette={paletteFor(template)}
                      ctx={ctx!}
                      cacheSalt={cacheSalt}
                      isCurrent={doc?.easy?.templateId === template.id}
                      fav={favs.has(template.id)}
                      onFav={() => toggleFav(template.id)}
                      onOpen={() => setDetail(template)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing matches these filters — clear one and try again.
            </p>
          )}
        </div>
      </DialogContent>

      {/* Detail view: the ONE interactive 3D preview. */}
      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92dvh] w-[min(100vw-1rem,44rem)] max-w-none overflow-y-auto">
          {detail && (
            <DetailView
              template={detail}
              palette={paletteFor(detail)}
              ctx={ctx}
              busy={busy}
              isCurrent={doc?.easy?.templateId === detail.id}
              onUse={() => void use(detail)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  research: "Research peptide",
  pharmaceutical: "Pharmaceutical-inspired",
  biotechnology: "Biotechnology",
  luxury: "Luxury",
  clinical: "Clinical",
  laboratory: "Laboratory",
  holographic: "Holographic",
  neon: "Neon",
  plain: "Plain & minimal",
  glossy: "Glossy",
  beauty: "Beauty & skincare",
  transparent: "Transparent",
  botanical: "Botanical & apothecary",
};

function TemplateCard({
  template,
  palette,
  ctx,
  cacheSalt,
  isCurrent,
  fav,
  onFav,
  onOpen,
}: {
  template: EasyTemplateDef;
  palette: EasyPalette;
  ctx: PreviewContext;
  cacheSalt: string;
  isCurrent: boolean;
  fav: boolean;
  onFav: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border-2 bg-surface p-2 transition-colors",
        isCurrent ? "border-primary" : "border-border hover:border-primary/40",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={`${template.name} — ${template.familyName} family, ${templatePrefersDark(template) ? "dark" : "light"} design`}
      >
        <TemplateThumb
          template={template}
          palette={palette}
          ctx={ctx}
          cacheSalt={cacheSalt}
          className="h-28 sm:h-32"
        />
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium">{template.name}</span>
          {isCurrent && <Badge>Current</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <Badge variant="outline">{templatePrefersDark(template) ? "Dark" : "Light"}</Badge>
          <Badge variant="secondary">{DENSITY_LABELS[template.density]}</Badge>
        </div>
      </button>
      <button
        type="button"
        aria-label={fav ? `Remove ${template.name} from favorites` : `Add ${template.name} to favorites`}
        aria-pressed={fav}
        onClick={onFav}
        className={cn(
          "absolute right-2 top-2 rounded-full bg-background/80 p-1.5 backdrop-blur transition-colors",
          fav ? "text-destructive" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Heart className={cn("size-4", fav && "fill-current")} aria-hidden />
      </button>
    </div>
  );
}

const DENSITY_LABELS: Record<ContentDensity, string> = {
  minimal: "Just the basics",
  standard: "Standard info",
  detailed: "Lots of details",
};

function DetailView({
  template,
  palette,
  ctx,
  busy,
  isCurrent,
  onUse,
}: {
  template: EasyTemplateDef;
  palette: EasyPalette;
  ctx: PreviewContext;
  busy: boolean;
  isCurrent: boolean;
  onUse: () => void;
}) {
  const [previewDoc, setPreviewDoc] = React.useState<LabelDocument | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      await ensureEasyFonts(template, ctx.pairingId);
      const build = buildEasyLabel({
        template,
        widthMm: ctx.baseDoc.label.widthMm,
        heightMm: ctx.baseDoc.label.heightMm,
        bleedMm: ctx.baseDoc.label.bleedMm,
        safeMm: ctx.baseDoc.label.safeMm,
        material: ctx.material,
        option: ctx.option,
        intensity: ctx.intensity,
        palette,
        fields: ctx.fields,
        enabled: ctx.enabled,
        measure: measureTextHeightMm,
      });
      if (!alive) return;
      setPreviewDoc({
        ...ctx.baseDoc,
        background: build.background,
        substrateId: build.substrateId,
        objects: build.objects,
      });
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [template, palette, ctx]);

  return (
    <div className="space-y-3">
      <DialogHeader>
        <DialogTitle>{template.name}</DialogTitle>
        <DialogDescription>
          {template.familyName} family · {DENSITY_LABELS[template.density]} ·{" "}
          {templatePrefersDark(template) ? "dark" : "light"} design
        </DialogDescription>
      </DialogHeader>
      {previewDoc ? (
        <VialStage doc={previewDoc} className="h-72 sm:h-80" />
      ) : (
        <Skeleton className="h-72 rounded-xl sm:h-80" />
      )}
      <div className="flex flex-wrap gap-1">
        {template.category.map((c) => (
          <Badge key={c} variant="secondary">
            {CATEGORY_LABELS[c]}
          </Badge>
        ))}
        {template.recommendedGlass.length > 0 && (
          <Badge variant="outline">
            Best on {template.recommendedGlass.join(" / ")} glass
          </Badge>
        )}
        <Badge variant="success">Free</Badge>
      </div>
      <Button className="w-full" disabled={busy || isCurrent} onClick={onUse}>
        {isCurrent ? "This is your current template" : busy ? "Applying…" : "Use this template"}
      </Button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
