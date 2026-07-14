"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CopyPlus, Download, SlidersHorizontal, Undo2 } from "lucide-react";
import { loadDocument, undo } from "@/lib/document/commands";
import type { LabelDocument } from "@/lib/document/schema";
import { ensureFinishesRegistered } from "@/lib/finishes";
import { loadFontsForDocument } from "@/lib/fonts/registry";
import { getEasyPalette } from "@/lib/easy/palettes";
import {
  getMaterial,
  getMaterialOption,
  placementChoices,
  type EffectPlacement,
} from "@/lib/easy/materials";
import { getEasyTemplate, templatesForMaterial } from "@/lib/easy/templates";
import {
  getPairing,
  pairingsForMood,
  PERSONALITIES,
  pairingsForPersonality,
  type PersonalityId,
} from "@/lib/easy/typography";
import { fontCssFamily, loadFont } from "@/lib/fonts/registry";
import { applyEasyChange } from "@/lib/easy/fields";
import { getStorageAdapter } from "@/lib/storage";
import { useCanUndoRedo, useDoc } from "@/stores/document-store";
import { useProjectSessionStore } from "@/stores/project-session-store";
import { saveNow, useAutosave } from "@/components/editor/hooks/use-autosave";
import { ExportDialog } from "@/components/editor/export-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ContentForm } from "./content-form";
import { ExportWizard } from "./export-wizard";
import { MaterialPicker } from "./material-picker";
import { MatchingLabelDialog } from "./matching-label-dialog";
import { TemplateBrowser } from "./template-browser";
import { VialStage } from "./vial-stage";
import { cn } from "@/lib/utils";

/**
 * The Easy editor: the vial preview is the canvas, the form is the tool.
 * Same document, same commands, same autosave as the Advanced Editor —
 * "Customize in Advanced Editor" is one click and loses nothing, and
 * documents without Easy metadata redirect there automatically.
 */

type LoadState = "loading" | "ready" | "not-found" | "error";

export function EasyEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [advancedExportOpen, setAdvancedExportOpen] = React.useState(false);
  const [matchingOpen, setMatchingOpen] = React.useState(false);
  const doc = useDoc();
  const projectName = useProjectSessionStore((s) => s.projectName);
  const { canUndo } = useCanUndoRedo();

  React.useEffect(() => {
    ensureFinishesRegistered();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const project = await getStorageAdapter().getProject(projectId);
        if (cancelled) return;
        if (!project) {
          setLoadState("not-found");
          return;
        }
        if (!project.doc.easy) {
          // Advanced-only project — this surface can't edit it meaningfully.
          router.replace(`/editor/${projectId}`);
          return;
        }
        await loadFontsForDocument(project.doc);
        if (cancelled) return;
        useProjectSessionStore.getState().startSession(project.id, project.name);
        loadDocument(project.doc);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
      useProjectSessionStore.getState().endSession();
    };
  }, [projectId, router]);

  useAutosave(projectId, loadState === "ready");

  const handleSave = React.useCallback(() => {
    void saveNow(projectId)
      .then(() => toast.success("Saved"))
      .catch(() => toast.error("Save failed"));
  }, [projectId]);

  if (loadState === "not-found") {
    return (
      <CenteredMessage
        title="Label not found"
        body="This label doesn't exist in this browser's storage."
      />
    );
  }
  if (loadState === "error") {
    return (
      <CenteredMessage
        title="Couldn't open this label"
        body="The stored data appears to be corrupted."
      />
    );
  }
  if (loadState === "loading" || !doc || !doc.easy) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-4" aria-busy>
        <Skeleton className="h-12" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-105" />
          <Skeleton className="h-105" />
        </div>
      </div>
    );
  }

  const material = getMaterial(doc.easy.materialId);
  const option = material
    ? getMaterialOption(material, doc.easy.materialOptionId)
    : undefined;
  const palettes = material?.paletteIds.map(getEasyPalette) ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to your labels">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <button
            type="button"
            onClick={handleSave}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium sm:flex-none"
            title="Save now"
          >
            {projectName || "My label"}
          </button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Saves automatically
          </span>
          <span className="flex-1 sm:hidden" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => undo()}
          >
            <Undo2 className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => setMatchingOpen(true)}
          >
            <CopyPlus className="size-4" aria-hidden />
            Matching label
          </Button>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href={`/editor/${projectId}`}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Advanced Editor
            </Link>
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Download className="size-4" aria-hidden />
            Download / print
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-5 p-4 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        {/* Preview: sticky on desktop, docked on top for phones. */}
        <VialStage
          doc={doc}
          className={cn(
            "top-[4.5rem] h-72 sm:h-96 lg:sticky lg:h-[calc(100dvh-6.5rem)]",
          )}
        />

        <div className="space-y-5 pb-24 lg:pb-8">
          {palettes.length > 0 && (
            <section aria-label="Colors" className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Colors
              </p>
              <ul className="flex flex-wrap gap-2">
                {palettes.map((palette) => (
                  <li key={palette.id}>
                    <button
                      type="button"
                      title={palette.name}
                      aria-label={`Use the ${palette.name} colors`}
                      aria-pressed={doc.easy!.paletteId === palette.id}
                      onClick={() =>
                        void applyEasyChange({ paletteId: palette.id })
                      }
                      className={cn(
                        "flex h-9 w-14 overflow-hidden rounded-lg border-2 transition-colors",
                        doc.easy!.paletteId === palette.id
                          ? "border-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <span
                        className="h-full w-1/2"
                        style={{ backgroundColor: palette.bg ?? "#e5e7eb" }}
                      />
                      <span className="flex h-full w-1/2 flex-col">
                        <span
                          className="h-1/2"
                          style={{ backgroundColor: palette.text }}
                        />
                        <span
                          className="h-1/2"
                          style={{ backgroundColor: palette.accent }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <DesignSection doc={doc} />

          <TypographySection doc={doc} />

          <QuickFixes doc={doc} />

          <MaterialSection
            materialName={material?.name}
            optionName={option?.name}
            placement={(doc.easy.placement as EffectPlacement | undefined) ?? "auto"}
            choices={material ? placementChoices(material) : null}
            selection={{
              materialId: doc.easy.materialId,
              optionId: doc.easy.materialOptionId,
              intensity: doc.easy.intensity ?? material?.defaultIntensity ?? "balanced",
            }}
          />

          <section aria-label="Label information" className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Label information
            </p>
            <ContentForm doc={doc} />
          </section>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Need pixel-level control — move things by hand, add shapes and
            images?{" "}
            <Link
              href={`/editor/${projectId}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Customize in the Advanced Editor
            </Link>{" "}
            — it edits this same label, and you can come back anytime.
          </p>
        </div>
      </main>

      <ExportWizard
        doc={doc}
        open={exportOpen}
        onOpenChange={setExportOpen}
        onAdvanced={() => setAdvancedExportOpen(true)}
      />
      <ExportDialog
        doc={doc}
        open={advancedExportOpen}
        onOpenChange={setAdvancedExportOpen}
      />
      <MatchingLabelDialog
        doc={doc}
        open={matchingOpen}
        onOpenChange={setMatchingOpen}
      />
    </div>
  );
}

/**
 * §5 design variations: switch the layout family with your words intact,
 * or flip between the material's dark and light palettes — every action a
 * single undoable engine pass.
 */
function DesignSection({ doc }: { doc: LabelDocument }) {
  const easy = doc.easy!;
  const [browserOpen, setBrowserOpen] = React.useState(false);
  const material = getMaterial(easy.materialId);
  if (!material) return null;
  const eligible = templatesForMaterial(material.id).filter(
    (t) =>
      (!t.minHeightMm || doc.label.heightMm >= t.minHeightMm) &&
      (!t.minWidthMm || doc.label.widthMm >= t.minWidthMm),
  );
  // A short curated strip (featured first) — the full library lives in the
  // browser so 45+ templates never become 45 buttons.
  const current = eligible.find((t) => t.id === easy.templateId);
  const quick = [
    ...(current ? [current] : []),
    ...eligible.filter(
      (t) => t.id !== easy.templateId && t.featured,
    ),
    ...eligible.filter((t) => t.id !== easy.templateId && !t.featured),
  ].slice(0, 6);
  const currentPalette = getEasyPalette(easy.paletteId);
  const oppositeTone = material.paletteIds
    .map(getEasyPalette)
    .find((p) => p.dark !== currentPalette.dark);

  return (
    <section aria-label="Design" className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Layout
      </p>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((layout) => (
          <Button
            key={layout.id}
            variant={layout.id === easy.templateId ? "primary" : "outline"}
            size="sm"
            className="h-8 text-xs"
            aria-pressed={layout.id === easy.templateId}
            onClick={() => void applyEasyChange({ templateId: layout.id })}
          >
            {layout.name}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setBrowserOpen(true)}
        >
          Browse all templates ({eligible.length})
        </Button>
        {oppositeTone && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => void applyEasyChange({ paletteId: oppositeTone.id })}
          >
            Try a {currentPalette.dark ? "light" : "dark"} version
          </Button>
        )}
      </div>
      <TemplateBrowser open={browserOpen} onOpenChange={setBrowserOpen} doc={doc} />
    </section>
  );
}

/**
 * Typography personalities (§9): no font dropdowns — pick a feel, get a
 * curated pairing. "Try another font" cycles pairings that suit the
 * current mood; the label itself is the live preview and every change is
 * one undo step. Fonts load lazily so the pairing name renders in its own
 * display face.
 */
function TypographySection({ doc }: { doc: LabelDocument }) {
  const easy = doc.easy!;
  const template = getEasyTemplate(easy.templateId);
  const [personality, setPersonality] = React.useState<PersonalityId | null>(null);
  if (!template) return null;
  const pairing = getPairing(easy.pairingId ?? template.pairingId);
  const overridden = Boolean(easy.pairingId) && easy.pairingId !== template.pairingId;

  const cycle = () => {
    const pool = personality
      ? pairingsForPersonality(personality)
      : pairingsForMood(pairing.mood);
    if (pool.length === 0) return;
    const index = pool.findIndex((p) => p.id === pairing.id);
    const next = pool[(index + 1) % pool.length]!;
    void applyEasyChange({ pairingId: next.id });
  };

  const pickPersonality = (id: PersonalityId) => {
    setPersonality(id);
    const pool = pairingsForPersonality(id);
    const next = pool.find((p) => p.id !== pairing.id) ?? pool[0];
    if (next) void applyEasyChange({ pairingId: next.id });
  };

  return (
    <section aria-label="Typography" className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Typography
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PERSONALITIES.map((p) => (
          <Button
            key={p.id}
            variant={
              (personality ?? pairing.mood[0]) === p.id ? "primary" : "outline"
            }
            size="sm"
            className="h-8 text-xs"
            aria-pressed={(personality ?? pairing.mood[0]) === p.id}
            title={p.blurb}
            onClick={() => pickPersonality(p.id)}
          >
            {p.name}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PairingName pairing={pairing} />
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={cycle}>
          Try another font
        </Button>
        {overridden && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-primary"
            onClick={() => {
              setPersonality(null);
              void applyEasyChange({ pairingId: null });
            }}
          >
            Use this layout&apos;s font
          </Button>
        )}
      </div>
    </section>
  );
}

/** The pairing's name, rendered in its own display face once loaded. */
function PairingName({ pairing }: { pairing: ReturnType<typeof getPairing> }) {
  // Track WHICH pairing finished loading — comparing ids avoids a
  // synchronous reset-setState in the effect (react-hooks rule).
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    loadFont(pairing.displayFamily, pairing.displayWeights[0] ?? 400)
      .then(() => {
        if (alive) setLoadedId(pairing.id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pairing]);
  const ready = loadedId === pairing.id;
  return (
    <span
      className="text-sm"
      style={
        ready
          ? {
              fontFamily: `"${fontCssFamily(pairing.displayFamily)}", inherit`,
              fontWeight: pairing.displayWeights[0] ?? 400,
            }
          : undefined
      }
    >
      {pairing.name}
    </span>
  );
}

/**
 * §4 one-click corrections: controlled engine re-runs (all undoable).
 * "Fit everything" and "Easier to read" persist as tweaks so later edits
 * keep the fix; "Balance layout" simply regenerates — which also cleans up
 * anything dragged around in the Advanced Editor.
 */
function QuickFixes({ doc }: { doc: LabelDocument }) {
  const tweaks = doc.easy?.tweaks;
  const tightFit = doc.objects.some(
    (o) => o.type === "text" && Boolean(o.slot) && o.fontSizePt <= 4.6,
  );
  const nameScale = tweaks?.nameScale ?? 1;

  const fix = (change: Parameters<typeof applyEasyChange>[0]) =>
    void applyEasyChange(change);

  // "Make it more …" — deterministic: jump to the strongest template for
  // that mood available on this material (content and colors carry over).
  const easy = doc.easy!;
  const material = getMaterial(easy.materialId);
  const makeIt = (vibe: "premium" | "minimal" | "bold" | "clinical" | "futuristic") => {
    if (!material) return;
    const candidates = templatesForMaterial(material.id)
      .filter((t) => t.id !== easy.templateId)
      .sort(
        (a, b) =>
          (b.vibe[vibe] ?? 0) - (a.vibe[vibe] ?? 0) || a.id.localeCompare(b.id),
      );
    const next = candidates[0];
    if (next && (next.vibe[vibe] ?? 0) > 0) fix({ templateId: next.id });
  };
  const effectChoices = material ? placementChoices(material) : null;
  const INTENSITIES = ["subtle", "balanced", "bold", "maximum"] as const;
  const intensity = easy.intensity ?? material?.defaultIntensity ?? "balanced";
  const intensityIndex = INTENSITIES.indexOf(intensity);

  return (
    <section aria-label="Quick fixes" className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Make it…
      </p>
      <div className="flex flex-wrap gap-1.5">
        <FixButton onClick={() => makeIt("premium")}>More premium</FixButton>
        <FixButton onClick={() => makeIt("minimal")}>Cleaner</FixButton>
        <FixButton onClick={() => makeIt("bold")}>Bolder</FixButton>
        <FixButton onClick={() => makeIt("clinical")}>More clinical</FixButton>
        <FixButton onClick={() => makeIt("futuristic")}>More futuristic</FixButton>
        {effectChoices && (
          <>
            <FixButton
              disabled={intensityIndex >= INTENSITIES.length - 1}
              onClick={() => fix({ intensity: INTENSITIES[intensityIndex + 1]! })}
            >
              More {material!.id === "neon" ? "neon" : "effect"}
            </FixButton>
            <FixButton
              disabled={intensityIndex <= 0}
              onClick={() => fix({ intensity: INTENSITIES[intensityIndex - 1]! })}
            >
              Less {material!.id === "neon" ? "neon" : "effect"}
            </FixButton>
          </>
        )}
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Quick fixes
      </p>
      {tightFit && (
        <p className="text-xs text-warning-foreground" role="status">
          Some text is getting very small — try “Fit everything” or “Simplify”.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <FixButton onClick={() => fix({ relayout: true })}>Balance layout</FixButton>
        <FixButton
          pressed={tweaks?.tight}
          onClick={() => fix({ tweaks: { tight: !tweaks?.tight } })}
        >
          Fit everything
        </FixButton>
        <FixButton
          disabled={nameScale >= 1.6}
          onClick={() =>
            fix({ tweaks: { nameScale: Math.min(nameScale * 1.15, 1.6) } })
          }
        >
          Bigger product name
        </FixButton>
        <FixButton
          pressed={tweaks?.textBoost}
          onClick={() => fix({ tweaks: { textBoost: !tweaks?.textBoost } })}
        >
          Easier to read
        </FixButton>
        <FixButton onClick={() => fix({ simplify: true })}>Simplify</FixButton>
        {(tweaks?.tight || tweaks?.textBoost || nameScale !== 1) && (
          <FixButton
            onClick={() =>
              fix({ tweaks: { tight: false, textBoost: false, nameScale: undefined } })
            }
          >
            Reset fixes
          </FixButton>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Every fix is one undo step (Cmd/Ctrl+Z).
      </p>
    </section>
  );
}

function FixButton({
  children,
  onClick,
  pressed,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={pressed ? "primary" : "outline"}
      size="sm"
      className="h-8 text-xs"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function MaterialSection({
  materialName,
  optionName,
  placement,
  choices,
  selection,
}: {
  materialName?: string;
  optionName?: string;
  placement: EffectPlacement;
  choices: ReturnType<typeof placementChoices>;
  selection: { materialId: string; optionId: string; intensity: "subtle" | "balanced" | "bold" | "maximum" };
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <section aria-label="Material" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Material
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-primary"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Done" : "Change material"}
        </Button>
      </div>
      {!open ? (
        <p className="text-sm text-muted-foreground">
          {materialName ?? "Material"}
          {optionName ? ` — ${optionName}` : ""}
        </p>
      ) : (
        <MaterialPicker
          compact
          value={selection}
          onChange={(next) => {
            void applyEasyChange({
              material: { materialId: next.materialId, optionId: next.optionId },
              intensity: next.intensity,
            });
          }}
        />
      )}
      {choices && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">
            Where should the effect go?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {choices.map((choice) => (
              <Button
                key={choice.id}
                variant={placement === choice.id ? "primary" : "outline"}
                size="sm"
                className="h-8 text-xs"
                aria-pressed={placement === choice.id}
                title={choice.hint}
                onClick={() => void applyEasyChange({ placement: choice.id })}
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      <Button asChild>
        <Link href="/dashboard">Back to your labels</Link>
      </Button>
    </div>
  );
}
